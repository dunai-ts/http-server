/**
 * @module @dunai/server
 */

import { addControllerParamDecoration } from '@dunai/core';
import { IDecoratedParamHttpResolveData } from './Common';

export const ROUTE_PATH_PARAM    = 'PATH';
export const ROUTE_QUERY_PARAM   = 'QUERY';
export const ROUTE_BODY_PARAM    = 'BODY';
export const ROUTE_HTTP_REQUEST  = 'HTTP_REQUEST';
export const ROUTE_HTTP_RESPONSE = 'HTTP_RESPONSE';

/**
 * Get parameter from path
 *
 * If call without parameters return all path parameters
 * @param key
 * @decorator
 */
export function Path(key?: string) {
    return addControllerParamDecoration({
        type       : ROUTE_PATH_PARAM,
        useFunction: (data: IDecoratedParamHttpResolveData) => {
            return key ? data.http.params[key] : data.http.params;
        }
    });
}

/**
 * Get parameter from query
 *
 * If call without parameters return all query parameters
 * @param key
 * @decorator
 */
export function Query(key?: string) {
    return addControllerParamDecoration({
        type       : ROUTE_QUERY_PARAM,
        useFunction: (data: IDecoratedParamHttpResolveData) => key ? data.http.query[key] : data.http.query
    });
}

/**
 * Get parameter from body
 *
 * If call without parameters return all body parameters
 * @param key
 * @decorator
 */
export function Body(key?: string) {
    return addControllerParamDecoration({
        type       : ROUTE_BODY_PARAM,
        useFunction: (data: IDecoratedParamHttpResolveData) => key ? (data.http.body ? data.http.body[key] : undefined) : data.http.body
    });
}

/**
 * Get raw http request
 *
 * @decorator
 */
export function HttpRequest() {
    return addControllerParamDecoration({
        type       : ROUTE_HTTP_REQUEST,
        useFunction: (data: IDecoratedParamHttpResolveData) => data.http || null
    });
}

/**
 * Get raw http response
 *
 * @decorator
 */
export function HttpResponse() {
    return addControllerParamDecoration({
        type       : ROUTE_HTTP_RESPONSE,
        useFunction: (data: IDecoratedParamHttpResolveData) => data.http ? data.http.res : null
    });
}
