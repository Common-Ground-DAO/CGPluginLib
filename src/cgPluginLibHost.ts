import { PluginRequestInner } from "../types";
import crypto from 'crypto';

class CgPluginLibHost {
  private static instance: CgPluginLibHost | null = null;
  private static privateKeyString: string;
  private static privateKey: crypto.KeyLike;
  private static publicKeyString: string;
  private static publicKey: crypto.KeyLike;

  private constructor() {
    // The constructor is disabled. Use initialize() to create an instance.
  }

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

  public static getInstance(): CgPluginLibHost {
    if (!CgPluginLibHost.instance) {
      throw new Error('CgPluginLibHost is not initialized. Call initialize() first.');
    }
    return CgPluginLibHost.instance;
  }

  public async signRequest(preRequest: Omit<PluginRequestInner, 'requestId'>): Promise<{request: string, signature: string}> {
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

  public async verifyRequest(request: string, signature: string): Promise<boolean> {
    const verify = crypto.createVerify('SHA256');
    verify.update(request);
    verify.end();
    return verify.verify(CgPluginLibHost.publicKey, Buffer.from(signature, 'base64'));
  }
}

export default CgPluginLibHost;