import type {
  CreateStoryInput,
  PublicStoryGroup,
  Story,
  StoryFormValues,
  StoryMutationResult,
  StoryQueryResult,
  StoryStatus,
  Topic,
  UpdateStoryInput,
  UploadedMedia,
} from "../types/story";

interface GraphQLErrorPayload {
  message: string;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLErrorPayload[];
}

interface RequestOptions<TVariables> {
  endpoint: string;
  query: string;
  variables?: TVariables;
  token?: string;
}

export class StoryApiError extends Error {
  readonly code?: number | string;

  constructor(message: string, code?: number | string) {
    super(message);
    this.name = "StoryApiError";
    this.code = code;
  }
}

const assertEndpoint = (endpoint: string): string => {
  const value = endpoint.trim();
  if (!value) {
    throw new StoryApiError(
      "VITE_CONTENT_SERVICE_URL is not configured. Add it to .env.local and restart Vite.",
    );
  }
  return value;
};

const graphqlRequest = async <TData, TVariables = Record<string, never>>({
  endpoint,
  query,
  variables,
  token,
}: RequestOptions<TVariables>): Promise<TData> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;

  let response: Response;
  try {
    response = await fetch(assertEndpoint(endpoint), {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
  } catch {
    throw new StoryApiError(
      "Unable to reach the Story API. Check the endpoint, network, CORS, and mixed-content settings.",
    );
  }

  let payload: GraphQLResponse<TData>;
  try {
    payload = (await response.json()) as GraphQLResponse<TData>;
  } catch {
    throw new StoryApiError(
      `Story API returned a non-JSON response (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (!response.ok) {
    throw new StoryApiError(
      payload.errors?.[0]?.message || `Story API request failed (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (payload.errors?.length) {
    throw new StoryApiError(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new StoryApiError("Story API returned no data.");
  }

  return payload.data;
};

const resultError = (
  result: { code?: number; message?: string; errors?: string },
  fallback: string,
): StoryApiError =>
  new StoryApiError(result.message || result.errors || fallback, result.code);

const STORY_FIELDS = `
  id
  title
  content
  authorId
  authorName
  updatedBy
  topic { id name code }
  media {
    edges {
      node {
        id
        guid
        cdnUrl
        contentType
        mediaType
        mediaSubType
      }
    }
  }
`;

const ALL_TOPICS_QUERY = `
  query AllTopics {
    allTopics {
      __typename
      ... on TopicNode { id name code }
    }
  }
`;

const CREATE_STORY_MUTATION = `
  mutation CreateStory($storyInput: StoryInput!) {
    createStory(storyInput: $storyInput) {
      storyCreateResult {
        __typename
        ... on StoryMutationSuccess {
          code
          message
          story { ${STORY_FIELDS} }
        }
        ... on StoryMutationError { code message errors }
      }
    }
  }
`;

const UPDATE_STORY_MUTATION = `
  mutation UpdateStory($storyUpdateInput: StoryUpdateInput!) {
    updateStory(storyUpdateInput: $storyUpdateInput) {
      storyUpdateResult {
        __typename
        ... on StoryMutationSuccess {
          code
          message
          story { ${STORY_FIELDS} }
        }
        ... on StoryMutationError { code message errors }
      }
    }
  }
`;

const STORY_BY_ID_QUERY = `
  query StoryById($storyId: Int) {
    storyById(storyId: $storyId) {
      __typename
      ... on StoryQuerySuccess {
        code
        message
        story { ${STORY_FIELDS} }
      }
      ... on StoryQueryError { code message errors }
    }
  }
`;

const PUBLIC_SHOP_STORIES_QUERY = `
  query ShopStories($id: String) {
    shopById(shopId: $id) {
      __typename
      ... on ShopDetailQuerySuccess {
        shopInfo {
          id
          topicStories(topicList: [1, 2, 3]) {
            edges {
              node {
                topicName
                stories {
                  ${STORY_FIELDS}
                }
              }
            }
          }
        }
      }
      ... on ShopDetailQueryError { code message }
    }
  }
`;

const FILE_UPLOAD_MUTATION = `
  mutation UploadStoryFiles($files: [Upload!]!, $filesMetadata: [FileMetadata]!) {
    fileUpload(files: $files, filesMetadata: $filesMetadata) {
      result {
        __typename
        ... on FileUploadMutationSuccess { code message result }
        ... on FileUploadMutationError { code message }
      }
    }
  }
`;

export const fetchTopics = async (endpoint: string, token = ""): Promise<Topic[]> => {
  const data = await graphqlRequest<{
    allTopics?: Array<(Topic & { __typename?: string }) | null> | null;
  }>({ endpoint, token, query: ALL_TOPICS_QUERY });

  return (data.allTopics ?? []).filter(
    (topic): topic is Topic & { __typename?: string } =>
      Boolean(topic && topic.id && topic.name),
  );
};

export const createStory = async (
  endpoint: string,
  token: string,
  storyInput: CreateStoryInput,
): Promise<Story> => {
  const data = await graphqlRequest<{
    createStory?: { storyCreateResult?: StoryMutationResult | null } | null;
  }, { storyInput: CreateStoryInput }>({
    endpoint,
    token,
    query: CREATE_STORY_MUTATION,
    variables: { storyInput },
  });

  const result = data.createStory?.storyCreateResult;
  if (!result) throw new StoryApiError("Create Story returned no result.");
  if (result.__typename !== "StoryMutationSuccess") {
    throw resultError(result, "Failed to create Story.");
  }
  if (!result.story?.id) {
    throw new StoryApiError("Story was created but the API returned no Story ID.");
  }
  return result.story;
};

export const updateStory = async (
  endpoint: string,
  token: string,
  storyUpdateInput: UpdateStoryInput,
): Promise<Story> => {
  const data = await graphqlRequest<{
    updateStory?: { storyUpdateResult?: StoryMutationResult | null } | null;
  }, { storyUpdateInput: UpdateStoryInput }>({
    endpoint,
    token,
    query: UPDATE_STORY_MUTATION,
    variables: { storyUpdateInput },
  });

  const result = data.updateStory?.storyUpdateResult;
  if (!result) throw new StoryApiError("Update Story returned no result.");
  if (result.__typename !== "StoryMutationSuccess") {
    throw resultError(result, "Failed to update Story.");
  }
  if (!result.story) {
    throw new StoryApiError("Story was updated but the API returned no Story data.");
  }
  return result.story;
};

export const fetchStoryById = async (
  endpoint: string,
  storyId: number,
  token = "",
): Promise<Story> => {
  const data = await graphqlRequest<{ storyById?: StoryQueryResult | null }, { storyId: number }>({
    endpoint,
    token,
    query: STORY_BY_ID_QUERY,
    variables: { storyId },
  });

  const result = data.storyById;
  if (!result) throw new StoryApiError("Story detail returned no result.");
  if (result.__typename !== "StoryQuerySuccess") {
    throw resultError(result, "Failed to fetch Story.");
  }
  if (!result.story) throw new StoryApiError(`Story ${storyId} was not found.`);
  return result.story;
};

export const fetchPublicShopStories = async (
  endpoint: string,
  shopId: string,
  token = "",
): Promise<PublicStoryGroup[]> => {
  interface PublicResponse {
    shopById?: {
      __typename?: string;
      code?: number;
      message?: string;
      shopInfo?: {
        topicStories?: {
          edges?: Array<{
            node?: { topicName?: string; stories?: Story[] | null } | null;
          } | null> | null;
        } | null;
      } | null;
    } | null;
  }

  const data = await graphqlRequest<PublicResponse, { id: string }>({
    endpoint,
    token,
    query: PUBLIC_SHOP_STORIES_QUERY,
    variables: { id: shopId },
  });

  const shopResult = data.shopById;
  if (!shopResult?.shopInfo) {
    throw new StoryApiError(
      shopResult?.message ||
        (shopResult?.__typename
          ? `Public shop query returned ${shopResult.__typename}.`
          : "Public shop query returned no shop data."),
      shopResult?.code,
    );
  }

  return (shopResult.shopInfo.topicStories?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((node): node is { topicName?: string; stories?: Story[] | null } => Boolean(node))
    .map((node) => ({
      topicName: node.topicName,
      stories: node.stories ?? [],
    }));
};

const parsePossiblyEncodedJson = (value: unknown): unknown => {
  let parsed = value;
  for (let attempt = 0; attempt < 2 && typeof parsed === "string"; attempt += 1) {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      break;
    }
  }
  return parsed;
};

const parseUploadItem = (raw: unknown): UploadedMedia | null => {
  const parsed = parsePossiblyEncodedJson(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  if ("success" in record) {
    if (!record.success || typeof record.guid !== "string") return null;
    return {
      guid: record.guid,
      fileName: typeof record.fileName === "string" ? record.fileName : undefined,
      originalFileName:
        typeof record.originalFileName === "string"
          ? record.originalFileName
          : typeof record.fileName === "string"
            ? record.fileName
            : record.guid,
    };
  }

  const [originalFileName, nestedValue] = Object.entries(record)[0] ?? [];
  const nested = parsePossiblyEncodedJson(nestedValue);
  if (!originalFileName || !nested || typeof nested !== "object") return null;

  const details = nested as Record<string, unknown>;
  if (!details.success || typeof details.guid !== "string") return null;
  return {
    guid: details.guid,
    fileName: typeof details.fileName === "string" ? details.fileName : undefined,
    originalFileName,
  };
};

export const uploadStoryFiles = async (
  endpoint: string,
  token: string,
  files: File[],
): Promise<UploadedMedia[]> => {
  if (files.length === 0) return [];

  const formData = new FormData();
  formData.append(
    "operations",
    JSON.stringify({
      query: FILE_UPLOAD_MUTATION,
      variables: {
        files: files.map(() => null),
        filesMetadata: files.map(() => ({ contentType: 6, mediaSubType: "CARD" })),
      },
    }),
  );

  const map: Record<string, string[]> = {};
  files.forEach((_, index) => {
    map[String(index)] = [`variables.files.${index}`];
  });
  formData.append("map", JSON.stringify(map));
  files.forEach((file, index) => {
    formData.append(String(index), file);
  });

  let response: Response;
  try {
    response = await fetch(assertEndpoint(endpoint), {
      method: "POST",
      headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : undefined,
      body: formData,
    });
  } catch {
    throw new StoryApiError("Unable to reach the media upload API.");
  }

  const payload = (await response.json()) as GraphQLResponse<{
    fileUpload?: {
      result?: {
        __typename?: string;
        code?: number;
        message?: string;
        result?: unknown[];
      } | null;
    } | null;
  }>;

  if (!response.ok || payload.errors?.length) {
    throw new StoryApiError(
      payload.errors?.[0]?.message || `Media upload failed (HTTP ${response.status}).`,
      response.status,
    );
  }

  const result = payload.data?.fileUpload?.result;
  if (!result || result.__typename !== "FileUploadMutationSuccess") {
    throw new StoryApiError(result?.message || "Media upload failed.", result?.code);
  }

  const media = (result.result ?? []).map(parseUploadItem).filter(
    (item): item is UploadedMedia => Boolean(item),
  );
  if (media.length !== files.length) {
    throw new StoryApiError(
      `Uploaded ${media.length} of ${files.length} files. Story submission was stopped.`,
    );
  }
  return media;
};

const toPositiveInteger = (value: string | number, label: string): number => {
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new StoryApiError(`${label} must be a positive integer.`);
  }
  return parsed;
};

export const buildCreateStoryInput = (
  form: StoryFormValues,
  status: StoryStatus,
): CreateStoryInput => ({
  title: form.title.trim(),
  content: form.content,
  topic: toPositiveInteger(form.topicId, "Topic"),
  type: "SHOP",
  identifier: toPositiveInteger(form.shopId, "Shop ID"),
  authorName: form.authorName.trim(),
  status,
  media: [...form.mediaGuids],
});

export const buildUpdateStoryInput = (
  storyId: string | number,
  form: StoryFormValues,
  status: StoryStatus,
): UpdateStoryInput => ({
  id: toPositiveInteger(storyId, "Story ID"),
  title: form.title.trim(),
  content: form.content,
  topic: toPositiveInteger(form.topicId, "Topic"),
  updatedBy: String(toPositiveInteger(form.shopId, "Shop ID")),
  status,
  media: [...form.mediaGuids],
});
