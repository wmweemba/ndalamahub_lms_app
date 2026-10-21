describe('sendEmail', () => {
  const load = (sendImpl) => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.FROM_EMAIL = 'noreply@example.com';
    let sendEmail;
    jest.isolateModules(() => {
      jest.doMock('resend', () => ({
        Resend: jest.fn().mockImplementation(() => ({ emails: { send: sendImpl } }))
      }));
      ({ sendEmail } = require('../email'));
    });
    return sendEmail;
  };
  const msg = { to: 'a@b.com', subject: 's', html: '<p>x</p>' };

  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
  });

  it('reports sent on success', async () => {
    const sendEmail = load(jest.fn().mockResolvedValue({ data: { id: 'x' }, error: null }));
    expect(await sendEmail(msg)).toEqual({ sent: true, id: 'x' });
  });

  it('reports unsent when Resend returns an error object', async () => {
    const sendEmail = load(jest.fn().mockResolvedValue({ data: null, error: { message: 'bad' } }));
    expect(await sendEmail(msg)).toEqual({ sent: false, reason: 'bad' });
  });

  it('reports unsent when the send rejects', async () => {
    const sendEmail = load(jest.fn().mockRejectedValue(new Error('boom')));
    expect(await sendEmail(msg)).toEqual({ sent: false, reason: 'boom' });
  });
});
