describe('log', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('exports the npmlog singleton', () => {
    const log = require('../lib/log');
    expect(log).toBe(require('npmlog'));
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it("uses the 'notice' level in production", () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'production';
      const log = require('../lib/log');
      expect(log.level).toBe('notice');
    });
  });

  it("uses the 'info' level outside production", () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'development';
      const log = require('../lib/log');
      expect(log.level).toBe('info');
    });
  });
});
