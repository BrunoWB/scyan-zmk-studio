import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ChangelogModal } from '../ChangelogModal';
import { CHANGELOG_DATA } from '../../data/changelog';

describe('ChangelogModal', () => {
  it('renders null when closed', () => {
    const html = renderToString(<ChangelogModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders changelog dialog structure and releases when open', () => {
    const html = renderToString(<ChangelogModal isOpen={true} onClose={() => {}} />);

    expect(html).toContain('Change Log &amp; Release History');
    expect(html).toContain('Deployed updates and feature milestones for Scyan ZMK Studio');
    expect(html).toContain('Browse Full Git History');

    // Check that releases are present
    for (const release of CHANGELOG_DATA) {
      const escapedTitle = release.title.replace(/&/g, '&amp;');
      expect(html).toContain(escapedTitle);
      expect(html).toContain(release.version);

      if (release.patches && release.patches.length > 0) {
        for (const patch of release.patches) {
          expect(html).toContain(`patch ${patch.patch}`);
        }
      }
    }
  });

  it('contains expected SemVer structure in data', () => {
    expect(CHANGELOG_DATA.length).toBeGreaterThan(0);
    const first = CHANGELOG_DATA[0];
    expect(first.title).toBeDefined();
    expect(first.description).toBeDefined();
    expect(first.highlights.length).toBeGreaterThan(0);
    expect(first.patches.length).toBeGreaterThan(0);
  });
});
