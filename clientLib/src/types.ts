export type SafeRequest = {
    request: string; // JSON stringified SafeRequestInner
}

export type SafeRequestInner = {
    type: 'safeRequest';
    iframeUid: string;
    requestId: string;
    data: {
        type: 'init';
    }
}

export type InitResponse = {
    pluginId: string;
    userId: string;
}

export type SafeRequestResponse = InitResponse;

export type PluginContextData = {
    pluginId: string;
    userId: string;
}

export type CGPluginResponse<T extends object> = {
    data: T;
    __rawResponse: string;
}

export type PluginRequest = {
    request: string; // JSON stringified RequestInner
    signature: string;
}

export type PluginResponse = {
    response: string; // JSON stringified AnyResponsePayload or SafeRequestResponse
    signature?: string;
}

export type PluginRequestInner = {
    pluginId: string;
    requestId: string;
    iframeUid: string;
} & ({
    type: 'action';
    data: ActionPayload;
} | {
    type: 'request';
    data: RequestPayload;
})

export type PluginResponseInner = {
    data: AnyResponsePayload | SafeRequestResponse;
    pluginId: string;
    requestId: string;
}

export type RequestPayload = UserInfoRequestPayload | CommunityInfoRequestPayload;
export type ActionPayload = GiveRoleActionPayload;

export type UserInfoRequestPayload = {
    type: 'userInfo';
}

export type CommunityInfoRequestPayload = {
    type: 'communityInfo';
}

export type GiveRoleActionPayload = {
    type: 'giveRole';
    roleId: string;
    userId: string;
}

export interface UserInfoResponsePayload {
    id: string;
    name: string;
    email: string;
    roles: string[];
}

export interface CommunityInfoResponsePayload {
    id: string;
    title: string;
    roles: {
        id: string;
        title: string;
        type: string;
        permissions: string[];
        assignmentRules: {
            type: 'free'
        } | {
            type: 'token';
            rules: object;
        } | null;
    }[];
}

export interface ActionResponsePayload {
    success: boolean;
}

export type AnyResponsePayload = UserInfoResponsePayload | CommunityInfoResponsePayload | ActionResponsePayload;
