import type { MediaNode, Story } from "../types/story";
import { deserializeStoryContent } from "../utils/storyContent";

export const getStoryMedia = (story: Story | null): MediaNode[] =>
  (story?.media?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((media): media is MediaNode => Boolean(media?.guid));

interface StoryPreviewProps {
  imageUrl: (media: MediaNode) => string;
  label: string;
  story: Story;
}

export const StoryPreview = ({ imageUrl, label, story }: StoryPreviewProps) => {
  const media = getStoryMedia(story);
  const content = deserializeStoryContent(story.content);

  return (
    <article className="story-preview">
      <div className="preview-label">{label}</div>
      <h3>{story.title || "Untitled Story"}</h3>
      <div className="story-meta">
        <span>Story #{story.id}</span>
        {story.topic?.name && <span>{story.topic.name}</span>}
        {story.authorName && <span>By {story.authorName}</span>}
      </div>

      {media.length > 0 && (
        <div className="preview-media">
          {media.map((item) => {
            const url = imageUrl(item);
            return url ? <img key={item.guid} src={url} alt={story.title} /> : null;
          })}
        </div>
      )}

      <div
        className="ProseMirror rendered-story"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <details className="html-panel">
        <summary>Stored Story HTML</summary>
        <pre>{story.content}</pre>
      </details>
    </article>
  );
};
