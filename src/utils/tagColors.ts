const PALETTE = [
  { bg: '#FDE9D9', text: '#B4600F' },
  { bg: '#E4DEFB', text: '#5B3FD6' },
  { bg: '#FDE0E0', text: '#C23838' },
  { bg: '#DDF3E4', text: '#2E8B4F' },
  { bg: '#DCEEFB', text: '#2A72B5' },
];

export function colorForTag(tag: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}