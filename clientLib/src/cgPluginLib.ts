import {
  UserInfoResponsePayload,
  CommunityInfoResponsePayload,
  ActionResponsePayload,
  ActionPayload,
  PluginRequest,
  PluginRequestInner,
  PluginContextData,
  SafeRequest,
  SafeRequestInner,
  PluginResponse,
  CGPluginResponse,
  InitResponse,
  PluginResponseInner,
  UserFriendsResponsePayload,
  ErrorResponse,
  NavigateResponse,
} from './types';

export const MAX_REQUESTS_PER_MINUTE = 100;

// Convert Base64 to Uint8Array
function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * CgPluginLib - Client library for Cryptogram plugins
 * 
 * This library provides functionality for plugins to communicate securely with the Cryptogram platform.
 * It handles request signing, rate limiting, and message passing between the plugin iframe and parent window. 
 * 
 * Usage example:
 * ```typescript
 * // Initialize the library
 * const plugin = await CgPluginLib.initialize(iframeUid, signUrl, publicKey);
 * 
 * // Make requests to the platform
 * const userInfo = await plugin.getUserInfo();
 * 
 * // Perform actions
 * await plugin.giveRole(userId, roleId);
 * ```
 * 
 * The library uses a singleton pattern - only one instance can exist per iframe.
 * All communication is cryptographically signed to ensure security.
*/
class CgPluginLib {
  static instance: CgPluginLib | null = null;

  private static requestTimestampHistory: number[] = [];
  private static iframeUid: string;
  private static targetOrigin: string;
  private static parentWindow: Window;
  private static listeners: Record<string, (payload: CGPluginResponse<object>) => void>;
  private static signUrl: string;
  private static publicKeyString: string;
  private static publicKey: CryptoKey;

  private static contextData: PluginContextData;

  private constructor() {
    // The constructor is disabled. Use initialize() to create an instance.
  }

  /**
   * Initialize the CgPluginLib instance.
   * @param {string} iframeUid - The unique identifier for the iframe - This will be available to your plugin through the "iframeUid" parameter in the URL.
   * @param {string} signUrl - The URL for the request signing route - See the host lib "signRequest" method for more information.
   * @param {string} publicKey - The public key for the request signing.
   * @returns {Promise<CgPluginLib>} A promise that resolves to the CgPluginLib instance.
   */
  public static async initialize(iframeUid: string, signUrl: string, publicKey: string): Promise<CgPluginLib> {
    if (
      CgPluginLib.instance &&
      CgPluginLib.iframeUid === iframeUid &&
      CgPluginLib.signUrl === signUrl &&
      CgPluginLib.publicKeyString === publicKey
    ) {
      return CgPluginLib.instance;
    } else {
      CgPluginLib.instance?.__destroy();
    }

    // Convert PEM to binary ArrayBuffer
    function convertPemToBinary(pem: string) {
      const base64String = pem
          .replace(/-----BEGIN PUBLIC KEY-----/, "")
          .replace(/-----END PUBLIC KEY-----/, "")
          .replace(/\n/g, "")
          .trim();
      return base64ToArrayBuffer(base64String);
    }

    const parentOrigin = window.location?.ancestorOrigins?.[0];

    CgPluginLib.iframeUid = iframeUid;
    CgPluginLib.targetOrigin = parentOrigin || '*'; // Restrict communication to specific origins for security.
    CgPluginLib.parentWindow = window.parent; // Reference to the parent window.
    CgPluginLib.listeners = {}; // Store custom message listeners.
    CgPluginLib.signUrl = signUrl; // The URL for the request signing route.
    CgPluginLib.publicKeyString = publicKey;

    CgPluginLib.publicKey = await crypto.subtle.importKey('spki', convertPemToBinary(publicKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);

    // Create a new instance using the private constructor.
    const instance = new CgPluginLib();
    
    // Listen for messages from the parent.
    window.addEventListener('message', instance.__handleMessage.bind(instance));
    
    await instance.__initContextData();

    CgPluginLib.instance = instance;
    return instance;
  }

  /**
   * Get the singleton instance of CgPluginLib.
   * @returns {CgPluginLib} The singleton instance.
   * @throws {Error} If the instance is not initialized.
   */
  public static getInstance(): CgPluginLib {
    if (!CgPluginLib.instance) {
      throw new Error('CgPluginLib is not initialized. Call initialize() first.');
    }
    return CgPluginLib.instance;
  }

  private async __initContextData() {
    const response = await this.__safeRequest<InitResponse>({
      type: 'init',
    });

    CgPluginLib.contextData = {
      pluginId: response.data.pluginId,
      userId: response.data.userId,
      assignableRoleIds: response.data.assignableRoleIds || [],
    };
  }

  private __destroy() {
    window.removeEventListener('message', this.__handleMessage.bind(this));
  }

  /**
   * Send a message to the parent window.
   * @param {PluginRequest} payload - The data to send.
   */
  private __sendMessage(payload: PluginRequest | SafeRequest) {
    if (!CgPluginLib.parentWindow) {
      console.error('No parent window available to send messages.');
      return;
    }

    const now = Date.now();
    const history = CgPluginLib.requestTimestampHistory.filter((timestamp) => timestamp > now - 60000);
    history.push(now);
    CgPluginLib.requestTimestampHistory = history;

    if (history.length >= MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Max requests per minute reached for iframe: ' + CgPluginLib.iframeUid);
    }

    CgPluginLib.parentWindow.postMessage(payload, CgPluginLib.targetOrigin);
  }

  /**
   * Handle incoming messages from the parent.
   * @param {MessageEvent} event - The incoming message event.
   */
  private async __handleMessage(event: MessageEvent) {
    // Validate the origin of the message.
    if (CgPluginLib.targetOrigin !== '*' && event.origin !== CgPluginLib.targetOrigin) {
      return;
    }

    console.log('iframe got message', event.data);
    const { type, payload } = event.data as { type: string, payload: PluginResponse };
    const { response, signature } = payload;
    const responsePayload = JSON.parse(response) as PluginResponseInner;
    
    if (signature) {
      const signatureBuffer = base64ToArrayBuffer(signature);
      const encodedMessage = new TextEncoder().encode(response);

      const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', CgPluginLib.publicKey, signatureBuffer, encodedMessage);

      if (!isValid) {
        throw new Error('Invalid signature');
      }
    }

    if (type && CgPluginLib.listeners[type]) {
      CgPluginLib.listeners[type]({
        data: responsePayload.data,
        __rawResponse: response,
      });
    }
  }

  /**
   * Register a listener for a specific message type.
   * @param {string} type - The type of message to listen for.
   * @param {function} callback - The callback to invoke when the message is received.
   */
  private __on<T extends object>(type: string, callback: (payload: CGPluginResponse<T>) => void) {
    CgPluginLib.listeners[type] = callback as (payload: CGPluginResponse<object>) => void;
  }

  /**
   * Remove a listener for a specific message type.
   * @param {string} type - The type of message to remove.
   */
  private __off(type: string) {
    delete CgPluginLib.listeners[type];
  }

  /**
   * Send a safe request to the parent. This request does not require signing.
   * @param {SafeRequestInner['data']} payload - The data to send.
   * @param {number} timeout - The timeout for the request.
   * @param {number} maxAttempts - The maximum number of attempts to send the request.
   * @returns {Promise<CGPluginResponse<T>>} A promise that resolves to the response.
   */
  private __safeRequest<T extends object>(
    payload: SafeRequestInner['data'],
    timeout: number = 2000,
    maxAttempts: number = 3
  ): Promise<CGPluginResponse<T>> {
    return new Promise(async (resolve, reject) => {
    const requestId = `safeRequest-${Date.now()}-${payload.type}`;
    let timeoutId: number;

    // Listener for the response.
    const responseListener = (payload: CGPluginResponse<T>) => {
      resolve(payload);
      clearTimeout(timeoutId);
      this.__off(requestId);
    };

    // Set up the listener for the response.
    this.__on(requestId, responseListener);

    const safeRequest: SafeRequest = {
      request: JSON.stringify({
        type: 'safeRequest',
        data: payload,
        iframeUid: CgPluginLib.iframeUid,
        requestId,
      }),
    };

    let attempts = 0;
    const attemptSend = () => {
      attempts++;

      // Send the request to the parent.
      this.__sendMessage(safeRequest);

      timeoutId = setTimeout(() => {
        if (attempts < maxAttempts) {
          attemptSend();
        } else {
          reject(new Error('Request timed out'));
          this.__off(requestId);
        }
      }, timeout);
    };

      attemptSend();
    });
  }

  /**
   * Send a request to the parent. The request payload will first be signed by the host lib before being sent to the parent.
   * @param {PluginRequestInner} payload - The data to send.
   * @param {number} timeout - The timeout for the request.
   * @param {number} maxAttempts - The maximum number of attempts to send the request.
   * @returns {Promise<CGPluginResponse<T>>} A promise that resolves to the response.
   */
  private __request<T extends object>(
    payload: Omit<PluginRequestInner, 'requestId' | 'pluginId'>,
    timeout: number = 2000,
    maxAttempts: number = 3
  ): Promise<CGPluginResponse<T>> {
    return new Promise(async (resolve, reject) => {
      const pluginRequest = await fetch(CgPluginLib.signUrl, {
        method: 'POST',
        body: JSON.stringify({ ...payload, pluginId: CgPluginLib.contextData.pluginId }),
      }).then(res => res.json()) as PluginRequest;
      
      const { request } = pluginRequest;
      const requestId = JSON.parse(request).requestId;

      let timeoutId: number;

      // Listener for the response.
      const responseListener = (payload: CGPluginResponse<T | ErrorResponse>) => {
        if ('error' in payload.data) {
          reject(new Error(payload.data.error));
        } else {
          resolve(payload as CGPluginResponse<T>);
        }
        clearTimeout(timeoutId);
        this.__off(requestId);
      };

      // Set up the listener for the response.
      this.__on(requestId, responseListener);

      let attempts = 0;
      const attemptSend = () => {
        attempts++;
        this.__sendMessage(pluginRequest);

        timeoutId = setTimeout(() => {
          if (attempts < maxAttempts) {
            attemptSend();
          } else {
            reject(new Error('Request timed out'));
          }
        }, timeout);
      };

      attemptSend();
    });
  }

  /**
   * Get the context data for the plugin. Context data includes the plugin ID and user ID.
   * @returns {PluginContextData} The context data.
   */
  public getContextData(): PluginContextData {
    return CgPluginLib.contextData;
  }

  /**
   * Get the user info from the parent.
   * @returns {Promise<CgPluginLib.Response.UserInfo>} A promise that resolves to the user info.
   */
  public async getUserInfo(): Promise<CGPluginResponse<UserInfoResponsePayload>> {
    return this.__request<UserInfoResponsePayload>({
      type: 'request',
      data: {
        type: 'userInfo',
      },
      iframeUid: CgPluginLib.iframeUid,
    });
  }

  /**
   * Get the community info from the parent.
   * @returns {Promise<CgPluginLib.Response.CommunityInfo>} A promise that resolves to the community info.
   */
  public async getCommunityInfo(): Promise<CGPluginResponse<CommunityInfoResponsePayload>> {
    return this.__request<CommunityInfoResponsePayload>({
      type: 'request',
      data: {
        type: 'communityInfo',
      },
      iframeUid: CgPluginLib.iframeUid,
    });
  }

  /**
   * Get the friends from the current user.
   * @param {number} limit - Limit of entries to return.
   * @param {number} offset - Offset to the start of the friends list.
   * @returns {Promise<CgPluginLib.Response.UserFriends>} A promise that resolves to the user friends.
   */
  public async getUserFriends(limit: number, offset: number): Promise<CGPluginResponse<UserFriendsResponsePayload>> {
    return this.__request<UserFriendsResponsePayload>({
      type: 'request',
      data: {
        type: 'userFriends',
        limit,
        offset,
      },
      iframeUid: CgPluginLib.iframeUid,
    });
  }

  /**
   * Give a role to a user in the community.
   * @param {string} roleId - The ID of the role to give.
   * @param {string} userId - The ID of the user to give the role to.
   * @returns {Promise<ActionResponsePayload>} A promise that resolves to the action response.
   */
  public async giveRole(roleId: string, userId: string): Promise<CGPluginResponse<ActionResponsePayload>> {
    const payload: ActionPayload = { type: 'giveRole', roleId, userId };
    return this.__request<ActionResponsePayload>({
      type: 'action',
      data: payload,
      iframeUid: CgPluginLib.iframeUid,
    });
  }

  /**
   * Asks the user to open a new window with the given url.
   * @param {string} url - The URL to navigate to. Must be a valid URL.
   */
  public async navigate(url: string): Promise<CGPluginResponse<NavigateResponse>> {
    return this.__safeRequest<NavigateResponse>({
      type: 'navigate',
      to: url,
    });
  }
}

// Export the library as a global variable or as a module.
export default CgPluginLib;
