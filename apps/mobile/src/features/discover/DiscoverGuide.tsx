import { OrionGuide, type OrionGuideContent } from '../../components/guide/OrionGuide';

export const DISCOVER_GUIDE = {
  id: 'discover',
  title: 'Discover Guide',
  sections: [
    {
      id: 'find',
      title: 'Find something to watch',
      body: 'Search for movies, TV shows, or people using the search bar.',
    },
    {
      id: 'refine',
      title: 'Refine your search',
      body: 'Use the available filters to narrow your results and find relevant titles.',
    },
    {
      id: 'details',
      title: 'Explore the details',
      body: 'Select a title to view its information and available viewing options.',
    },
  ],
  actionLabel: 'Got it',
} as const satisfies OrionGuideContent;

export function DiscoverGuide() {
  return <OrionGuide content={DISCOVER_GUIDE} />;
}
