/**
 * @module @dunai/server
 */

import { Injector, Service, Type } from '@dunai/core';
import express, { Router } from 'express';
import * as http from 'http';
import cookieParser from 'cookie-parser';

import { ActionMeta, ControllerMeta, EntityError } from './Common';
import { ISessionStorage, SessionData } from './Session';
import { Request, Response } from './Interfaces';
import { deepFreeze } from './utils';

/**
 * HTTP server (bases on express.js)
 * @public
 */
@Service()
export class HttpServer {
    /**
     * Get action list of controller
     * @param controller
     * @return {ActionMeta[]}
     */
    public static getControllerActions(controller: any): ActionMeta[] {
        if (typeof controller !== 'object')
            throw new Error('Api must be already initialized');

        if (
            !('_actions' in controller) ||
            typeof controller._actions !== 'object'
        ) {
            console.log(
                `Error in controller "${controller.constructor.toString()}"`
            );
            throw new Error(`Controller must be decorated by @Controller\n  and must contain at least one action`);
        }

        const actions: ActionMeta[] = Object.keys(controller._actions).map(i => {
            const item = controller._actions[i];
            if (item instanceof ActionMeta)
                return item;
            else
                throw new Error(`Action must be decorated by @Action`);
        });

        return actions;
    }

    public express: express.Application;
    public server: http.Server;
    public sessionStorage: ISessionStorage;

    constructor() {
        this.express = express();
        this.express.use(cookieParser());
    }

    public setSessionStorage(sessionKey: any,//(req: express.Request, res: express.Response, next: () => void) => void,
                             storage: Type<ISessionStorage>) {
        if (this.sessionStorage)
            throw new Error('Session storage already exists');
        if (Array.isArray(sessionKey))
            this.express.use(...sessionKey);
        else
            this.express.use(sessionKey);

        const sessionStorage = Injector.resolve<ISessionStorage>(storage);
        this.sessionStorage = sessionStorage;
        this.express.use((req: Request, res: Response, next: () => void) => {
            const data = sessionStorage.get(req.session_id);
            req.session = deepFreeze(data);
            res.session = new SessionData(req.session);
            res.on('finish', () => {
                sessionStorage.set(req.session_id, res.session.getData(), data);
            });
            next();
        });
    }

    /**
     * Listen port
     * @param {number} port
     * @param {string} hostname
     * @return {Promise<void>}
     */
    public listen(port: number, hostname: string = '0.0.0.0'): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.express.all('*', (req, res) => {
                res.status(404).send('Page not found.');
            });

            this.server = this.express.listen(port, hostname, resolve);

            this.server.addListener('error', (e: any) => {
                reject(e);
                this.server.removeListener('listening', resolve);
            });
            this.server.addListener('listening', () => {
                resolve();
                this.server.removeListener('error', reject);
            });
        });
    }

    /**
     * Use handler
     * @param {RequestHandlerParams} handlers
     * @return {e.Application}
     */
    public use(...handlers: any[]): express.Application {
        return this.express.use(...handlers);
    }

    /**
     * Close port
     */
    public close(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.addListener('error', (e: any) => {
                reject(e);
                this.server.removeListener('close', resolve);
            });
            this.server.addListener('close', () => {
                resolve();
                this.server.removeListener('error', reject);
            });
            this.server.close(resolve);
        });
    }

    /**
     * Register controller
     * @param {string | RegExp} url
     * @param controller Controller, decorated @Controller
     */
    public registerController(url: string | RegExp, controller: any): void {
        const ctrl = Injector.resolve<any>(controller);

        const actions: ActionMeta[] = HttpServer.getControllerActions(ctrl);

        if (!actions) return;

        const router = express.Router();

        actions.forEach(action => {
            bind(router, ctrl, []);
        });

        this.express.use(url, router);
    }
}

/**
 * Bind action to express
 * @param router
 * @param controller
 */
function bind(router: Router, controller: Type<any> & ControllerMeta, actionParams: any[]): void {
    const handler = (req: Request, res: Response) => {
        const params: any[] = [req, res];
        Promise.all(params).then(
            resolved => controller[this.action](...resolved),
            (reject: Error | string) => {
                if (params[0] === req) params[0] = '[request]';
                if (params[1] === res) params[1] = '[response]';

                let reason: Error = null;
                if (typeof reject === 'object') reason = reject;
                else
                    reason = {
                        name   : 'Unknown',
                        message: reject
                    };

                const error: EntityError = {
                    ...reason,
                    message: reason.message,
                    meta   : this,
                    params
                };
                if (typeof controller['error'] === 'function') {
                    controller['error'](req, res, error);
                } else res.status(404).json('Not found');
            }
        );
    };

// this.methods.forEach(method => router[method](this.path, handler));
}
