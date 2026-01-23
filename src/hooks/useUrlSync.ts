import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStoryStore } from '../store/useStoryStore';

export function useUrlSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeStoryId, setActiveStory, userStories } = useStoryStore();
  const lastSyncedId = useRef<string | null>(null);

  // Extract diagram ID from URL path
  const match = location.pathname.match(/^\/d\/(.+)$/);
  const urlDiagramId = match ? match[1] : null;

  // Sync URL -> Store (only on initial load or direct URL navigation)
  useEffect(() => {
    // If URL has a diagram ID and it's different from what we last synced
    if (urlDiagramId && urlDiagramId !== lastSyncedId.current) {
      const storyExists = userStories.some(s => s.id === urlDiagramId);
      if (storyExists) {
        // Only update store if it's different
        if (urlDiagramId !== activeStoryId) {
          lastSyncedId.current = urlDiagramId;
          setActiveStory(urlDiagramId);
        }
      } else {
        // Diagram doesn't exist, redirect to home
        navigate('/', { replace: true });
      }
    }
  }, [urlDiagramId, userStories]);

  // Sync Store -> URL (when user selects a diagram via sidebar)
  useEffect(() => {
    // If store has a different active story than URL, update URL
    if (activeStoryId && activeStoryId !== urlDiagramId) {
      lastSyncedId.current = activeStoryId;
      navigate(`/d/${activeStoryId}`, { replace: true });
    } else if (!activeStoryId && urlDiagramId) {
      // Store cleared but URL still has diagram - go home
      navigate('/', { replace: true });
    }
  }, [activeStoryId]);
}
