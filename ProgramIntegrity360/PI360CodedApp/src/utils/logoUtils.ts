import uipathLogo from '../assets/uipath-logo-png_seeklogo-618304.png';

// Helper to resolve asset URLs for local development
const resolveAssetUrl = (url: string) => {
  if (import.meta.env.DEV) {
    return url;
  }
  return url;
};

// Default URL (fallback if env vars not set)
const DEFAULT_UIPATH_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/UiPath_2021.svg/320px-UiPath_2021.svg.png';

/**
 * Get logo sources based on environment configuration
 * @returns Object containing UiPath logo URL
 */
export const getLogoUrls = () => {
  const useLocalImages = import.meta.env.VITE_USE_LOCAL_IMAGES === 'true';

  const uipathLogoSrc = useLocalImages
    ? resolveAssetUrl(uipathLogo)
    : (import.meta.env.VITE_UIPATH_LOGO_URL || DEFAULT_UIPATH_URL);

  return {
    uipathLogoSrc,
  };
};
