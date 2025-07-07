export type SafeRequest = {
    request: string; // JSON stringified SafeRequestInner
}

export type SafeRequestInner = {
    type: 'safeRequest';
    iframeUid: string;
    requestId: string;
    data: {
        type: 'init';
    } | {
        type: 'navigate';
        to: string;
    } | {
        type: 'requestPermission';
        permission: 'email' | 'twitter' | 'lukso' | 'farcaster' | 'friends';
    };
}

export type InitResponse = {
    pluginId: string;
    userId: string;
    assignableRoleIds: string[];
}

export type OkResponse = {
    ok: true;
}

export type SafeRequestResponse = InitResponse | OkResponse;

export type ErrorResponse = {
    error: string;
}

export type PluginContextData = {
    pluginId: string;
    userId: string;
    assignableRoleIds: string[];
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
    data: AnyResponsePayload | SafeRequestResponse | ErrorResponse;
    pluginId: string;
    requestId: string;
}

export type RequestPayload = UserInfoRequestPayload | CommunityInfoRequestPayload | UserFriendsRequestPayload;
export type ActionPayload = GiveRoleActionPayload;

export type UserInfoRequestPayload = {
    type: 'userInfo';
}

export type CommunityInfoRequestPayload = {
    type: 'communityInfo';
}

export type UserFriendsRequestPayload = {
    type: 'userFriends';
    limit: number;
    offset: number;
}

export type GiveRoleActionPayload = {
    type: 'giveRole';
    roleId: string;
    userId: string;
}

export interface UserInfoResponsePayload {
    id: string;
    name: string;
    roles: string[];
    imageUrl: string;
    premium: 'FREE' | 'SILVER' | 'GOLD';
    twitter?: {
        username: string;
    };
    lukso?: {
        username: string;
        address: string;
    };
    farcaster?: {
        displayName: string;
        username: string;
        fid: number;
    };
    email?: string;
}

export interface CommunityInfoResponsePayload {
    id: string;
    title: string;
    url: string;
    smallLogoUrl: string;
    largeLogoUrl: string;
    headerImageUrl: string;
    official: boolean;
    premium: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
    roles: CommunityRole[];
}

export interface CommunityRole {
    id: string;
    title: string;
    type: 'PREDEFINED' | 'CUSTOM_MANUAL_ASSIGN' | 'CUSTOM_AUTO_ASSIGN';
    permissions: string[];
    assignmentRules: {
        type: 'free'
    } | {
        type: 'token';
        rules: object;
    } | null;
}

export interface UserFriendsResponsePayload {
    friends: Friend[];
}

export interface Friend {
    id: string;
    name: string;
    imageUrl: string;
}
export interface ActionResponsePayload {
    success: boolean;
}

export type AnyResponsePayload = UserInfoResponsePayload | CommunityInfoResponsePayload | UserFriendsResponsePayload | ActionResponsePayload;
