const util = require('../lib/util');

describe('util.escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(util.escapeXml('<')).toBe('&lt;');
    expect(util.escapeXml('>')).toBe('&gt;');
    expect(util.escapeXml('&')).toBe('&amp;');
    expect(util.escapeXml("'")).toBe('&apos;');
    expect(util.escapeXml('"')).toBe('&quot;');
  });

  it('escapes all special characters within a larger string', () => {
    expect(util.escapeXml(`Tom & Jerry's "5 < 10 > 3" show`)).toBe(
      'Tom &amp; Jerry&apos;s &quot;5 &lt; 10 &gt; 3&quot; show'
    );
  });

  it('leaves strings without special characters unchanged', () => {
    expect(util.escapeXml('plain text 123')).toBe('plain text 123');
  });

  it('returns an empty string unchanged', () => {
    expect(util.escapeXml('')).toBe('');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(util.escapeXml('a<b<c')).toBe('a&lt;b&lt;c');
  });

  it('throws when given a non-string value', () => {
    expect(() => util.escapeXml(undefined)).toThrow();
    expect(() => util.escapeXml(null)).toThrow();
  });
});
