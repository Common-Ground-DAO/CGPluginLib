import { PluginRequestInner } from "./types";
import crypto from 'crypto';

/**
 * The host library for the CGPluginLib.
 * This library is used to sign requests and verify responses to Common Ground.
 * 
 */
class CgPluginLibHost {
  private static instance: CgPluginLibHost | null = null;
  private static privateKeyString: string;
  private static privateKey: crypto.KeyLike;
  private static publicKeyString: string;
  private static publicKey: crypto.KeyLike;

  private constructor() {
    // The constructor is disabled. Use initialize() to create an instance.
  }

  /**
   * Initialize the CgPluginLibHost instance.
   * @param {string} privateKey - The private key for the request signing.
   * @param {string} publicKey - The public key for the request signing.
   * @returns {Promise<CgPluginLibHost>} A promise that resolves to the CgPluginLibHost instance.
   */
  public static async initialize(privateKey: string, publicKey: string): Promise<CgPluginLibHost> {
    if (CgPluginLibHost.instance && CgPluginLibHost.privateKeyString === privateKey && CgPluginLibHost.publicKeyString === publicKey) {
      return CgPluginLibHost.instance;
    }

    CgPluginLibHost.privateKeyString = privateKey;
    CgPluginLibHost.privateKey = crypto.createPrivateKey({
      key: privateKey,
      type: 'pkcs8',
      format: 'pem',
    });

    CgPluginLibHost.publicKeyString = publicKey;
    CgPluginLibHost.publicKey = crypto.createPublicKey({
      key: publicKey,
      type: 'spki',
      format: 'pem',
    });

    CgPluginLibHost.instance = new CgPluginLibHost();
    return CgPluginLibHost.instance;
  }

  /**
   * Get the singleton instance of CgPluginLibHost.
   * @returns {CgPluginLibHost} The singleton instance.
   * @throws {Error} If the instance is not initialized.
   */
  public static getInstance(): CgPluginLibHost {
    if (!CgPluginLibHost.instance) {
      throw new Error('CgPluginLibHost is not initialized. Call initialize() first.');
    }
    return CgPluginLibHost.instance;
  }

  /**
   * Sign a request for Common Ground. This must be done before every major request for your plugin, so you will
   * need to set up a route in your server to handle this.
   * 
   * @example
   * ```typescript
   * function handleRequest(req: Request) {
   * 
   * const body = await req.json();
   * 
   * const cgPluginLibHost = await CgPluginLibHost.initialize(privateKey, publicKey);
   * const { request, signature } = await cgPluginLibHost.signRequest(body);
   * 
   * return Response.json({ request, signature });
   * }
   * ```
   * 
   * @param {Omit<PluginRequestInner, 'requestId'>} preRequest - The request to sign.
   * @returns {Promise<{request: string, signature: string}>} A promise that resolves to the signed request and signature.
   */
  public async signRequest(preRequest: Omit<PluginRequestInner, 'requestId'>): Promise<{ request: string, signature: string }> {
    const requestId = `requestId-${new Date().getTime()}-${crypto.randomUUID()}`;
    const sign = crypto.createSign('SHA256');
    const request = JSON.stringify({
      ...preRequest,
      requestId,
    });
    sign.update(request);
    sign.end();

    const signature = sign.sign(CgPluginLibHost.privateKey, 'base64');
    return { request, signature };
  }

  /**
   * Verify a response from Common Ground. This can be done for any signed response from Common Ground.
   * The raw response will always include the response string and the signature from the CG server.
   * Run this if you want to verify an action has been performed by Common Ground, this is important if
   * you are dealing with sensitive data, such as giving roles to the user.
   * 
   * @example
   * ```typescript
   * const { request, signature } = await cgPluginLibHost.signRequest(body);
   * 
   * const verified = await cgPluginLibHost.verifyRequest(request, signature);
   * ```
   * 
   * @param {string} response - The response to verify.
   * @param {string} signature - The signature of the response.
   * @returns {Promise<boolean>} A promise that resolves to the verification result.
   */
  public async verifyResponse(response: string, signature: string): Promise<boolean> {
    const verify = crypto.createVerify('SHA256');
    verify.update(response);
    verify.end();
    return verify.verify(CgPluginLibHost.publicKey, Buffer.from(signature, 'base64'));
  }
}

export default CgPluginLibHost;