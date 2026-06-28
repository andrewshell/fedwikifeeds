const everyMinute = require('../lib/every-minute');
const log = require('../lib/log');

const ONE_MINUTE = 60000;
const START = new Date('2022-01-01T00:00:00.000Z').getTime();

describe('everyMinute', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
  });

  afterEach(() => {
    // everyMinute reschedules itself forever; clear (don't run) pending timers
    // so teardown can't trigger another recursive cycle.
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('invokes the callback immediately', () => {
    const callback = jest.fn().mockResolvedValue();
    everyMinute(callback, START);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(START);
  });

  it('defaults the expected cycle time to now when omitted', () => {
    const callback = jest.fn().mockResolvedValue();
    everyMinute(callback);
    expect(callback).toHaveBeenCalledWith(START);
  });

  it('schedules another run after the callback resolves', async () => {
    const callback = jest.fn().mockResolvedValue();
    everyMinute(callback, START);

    // Let the callback promise (and the .finally that schedules the next run) settle.
    await jest.advanceTimersByTimeAsync(0);
    expect(jest.getTimerCount()).toBe(1);

    // Fire exactly the one scheduled timer — bounded, no runaway recursion.
    await jest.advanceTimersToNextTimerAsync();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(START + ONE_MINUTE);
  });

  it('catches a rejected callback and still reschedules', async () => {
    const errorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    const callback = jest.fn().mockRejectedValue(new Error('boom'));

    everyMinute(callback, START);
    await jest.advanceTimersByTimeAsync(0);

    expect(errorSpy).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
  });

  it('skips past missed cycles when a run overruns its minute', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const callback = jest.fn().mockReturnValueOnce(gate).mockResolvedValue();

    everyMinute(callback, START);

    // The first run takes ~2.5 minutes of wall-clock before it resolves.
    jest.setSystemTime(START + 150000);
    release();
    await jest.advanceTimersByTimeAsync(0);

    // expectedCycleTime steps START -> +60000 -> +120000 -> +180000
    // (first value strictly past the current time of START + 150000).
    await jest.advanceTimersToNextTimerAsync();
    expect(callback).toHaveBeenLastCalledWith(START + 180000);
  });
});
