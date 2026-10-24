/**
 * Which Knowledge Center scenario holds the content for a dashboard topic — the bridge from
 * "this topic is weak" to "improve this page".
 *
 * Hand-curated, not string-matched: topic and scenario names never match exactly (Warehouse Security vs
 * Warehouse), and guessing would decide for the data, the same rule the best_for → scenario link follows.
 * Proposed by engineering; the content team owns it. `null` = deliberately no scenario: these topics are
 * about a capability (Low-light Imaging) or a buying stage (Product Comparison), not a place of use.
 */
export const TOPIC_SCENARIO: Record<string, string | null> = {
  'Warehouse Security': 'warehouse',
  'Retail Analytics': 'retail',
  'Office Security': 'office',
  'Perimeter Protection': 'perimeter',
  'Industrial Monitoring': 'industrial',
  'SMB Deployment': 'small-business',
  'Low-light Imaging': null,
  'Product Comparison': null,
};
