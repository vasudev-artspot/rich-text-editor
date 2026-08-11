export type StoryStatus = "DRAFT" | "PUBLISHED";

export interface Topic {
  id: string | number;
  name: string;
  code?: string;
}

export interface MediaNode {
  id?: string | number;
  guid: string;
  cdnUrl?: string;
  contentType?: string;
  mediaType?: string;
  mediaSubType?: string;
}

export interface MediaEdge {
  node?: MediaNode | null;
}

export interface Story {
  id: number;
  title: string;
  content: string;
  authorId?: string;
  authorName?: string;
  updatedBy?: string;
  topic?: Topic | null;
  media?: { edges?: MediaEdge[] | null } | null;
}

export interface StoryMutationError {
  __typename: "StoryMutationError";
  code?: number;
  message?: string;
  errors?: string;
}

export interface StoryMutationSuccess {
  __typename: "StoryMutationSuccess";
  code?: number;
  message?: string;
  story?: Story | null;
}

export type StoryMutationResult = StoryMutationSuccess | StoryMutationError;

export interface StoryQueryError {
  __typename: "StoryQueryError";
  code?: number;
  message?: string;
  errors?: string;
}

export interface StoryQuerySuccess {
  __typename: "StoryQuerySuccess";
  code?: number;
  message?: string;
  story?: Story | null;
}

export type StoryQueryResult = StoryQuerySuccess | StoryQueryError;

export interface CreateStoryInput {
  title: string;
  content: string;
  topic: number;
  type: "SHOP";
  identifier: number;
  authorName: string;
  status: StoryStatus;
  media: string[];
}

export interface UpdateStoryInput {
  id: number;
  title: string;
  content: string;
  topic: number;
  updatedBy: string;
  status: StoryStatus;
  media: string[];
}

export interface StoryFormValues {
  title: string;
  content: string;
  topicId: string;
  shopId: string;
  authorName: string;
  mediaGuids: string[];
}

export interface UploadedMedia {
  guid: string;
  fileName?: string;
  originalFileName: string;
}

export interface PublicStoryGroup {
  topicName?: string;
  stories: Story[];
}
