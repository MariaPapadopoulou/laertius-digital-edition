import { useEffect } from "react";

const BASE_TITLE = "Laertius - Lives of Eminent Philosophers";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} - Laertius` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
