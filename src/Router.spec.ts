import { Injector } from '@dunai/core';
import bodyParser from 'body-parser';
import { describe, it } from 'mocha';
import should from 'should';
import { Application, createApp } from './Application';
import { EntityError } from './Common';
import { HttpServer } from './HttpServer';
import { Request, Response } from './Interfaces';
import { Action, Body, Controller, Entity, Path, Query, Session } from './Router';
import { sessionFromCookie, sessionFromHeader, SessionStorageInMemory } from './Session';
import { fetch } from './utils.spec';

@Application()
class App {
    constructor(public server?: HttpServer) {
        this.server.use(bodyParser.json() as any);
    }

    public init(): void {
        this.server.registerController('/api', ApiController);
        this.server.registerController('/', DefaultController);
    }
}

@Controller('Ping controller')
class DefaultController {
    @Action('/')
    public index(req: any, res: any): void {
        return res.json({
            ping: 'ok'
        });
    }
}

@Controller('API controller')
class ApiController {
    @Action(['put', 'get'], '/:id')
    public index(req: any, res: any): void {
        return res.json({
            api: 'ok'
        });
    }
}

describe('Router service', () => {
    describe('Controller', () => {
        it('standard controller', () => {
            @Controller()
            class TestController {
                @Action('/')
                public index() {
                    // ok
                }
            }

            @Application()
            class TestApp {
                constructor(public server?: HttpServer) { }
            }

            const app = createApp(TestApp) as any;

            app.server.registerController('/', TestController);

            should(app).ok();
        });
        // it('prepared controller', () => {
        //    @Controller()
        //    class TestController {
        //        @Action('/')
        //        public index() {
        //            // ok
        //        }
        //    }
        //
        //    const controller = new TestController()
        //
        //    @Application()
        //    class TestApp {
        //        constructor(public server?: HttpServer) { }
        //    }
        //
        //    const app = createApp(TestApp) as any;
        //
        //    app.server.registerController('/', controller);
        //    app.server.registerController('/api', controller);
        //
        //    should(app).ok();
        // });
        it('error if controller not contains actions', () => {
            @Controller()
            class TestController {
            }

            @Application()
            class TestApp {
                constructor(public server?: HttpServer) {
                    server.registerController('/', TestController);
                }
            }

            should(() => createApp(TestApp)).throw('Controller must be decorated by @Controller\n' +
                '  and must contain at least one action');
        });
        it('no decorated controller', () => {
            class TestController {

            }

            @Application()
            class TestApp {
                constructor(server?: HttpServer) {
                    server.registerController('/', TestController);
                }
            }

            should(() => createApp(TestApp)).throw('Controller must be decorated by @Controller\n' +
                '  and must contain at least one action');
        });
    });

    describe('Params', () => {
        let app: App;

        beforeEach(() => {
            Injector.reset();
        });

        afterEach(async () => {
            await app.server.close();
        });

        it('default (req, res)', async () => {
            @Controller('Test controller')
            class TestController {
                @Action('put', '/:id')
                public index(req: any, res: any): void {
                    return res.json({
                        id  : req.params['id'],
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'put',
                'http://127.0.0.1:3000/test/a?foo=foo'
            );
            should(result).eql({
                status: 200,
                body  : {
                    id  : 'a',
                    test: 'ok'
                }
            });
        });
        it('default (only req)', async () => {
            @Controller('Test controller')
            class TestController {
                @Action('put', '/:id')
                public index(req: any): void {
                    return req.res.json({
                        id  : req.params['id'],
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'put',
                'http://127.0.0.1:3000/test/a?foo=foo'
            );
            should(result).eql({
                status: 200,
                body  : {
                    id  : 'a',
                    test: 'ok'
                }
            });
        });
        it('default (req, _, @Path(_)', async () => {
            @Controller('Test controller')
            class TestController {
                @Action('put', '/:id')
                public index(req: any, _, @Path('id') id: string): void {
                    return req.res.json({
                        id,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'put',
                'http://127.0.0.1:3000/test/a?foo=foo'
            );
            should(result).eql({
                status: 200,
                body  : {
                    id  : 'a',
                    test: 'ok'
                }
            });
        });
        it('default (req, @Path(), @Query(_))', async () => {
            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Path() id: object,
                    @Query('foo') foo: string
                ): void {
                    return req.res.json({
                        id,
                        foo,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a?foo=bar'
            );
            should(result).eql({
                status: 200,
                body  : {
                    id  : { id: 'a' },
                    foo : 'bar',
                    test: 'ok'
                }
            });
        });
        it('default (req, @Path, @Body)', async () => {
            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Path('id') id: string,
                    @Body('foo') foo: string
                ): void {
                    return req.res.json({
                        id,
                        foo,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 200,
                body  : {
                    id  : 'a',
                    foo : {
                        obj: 'bar'
                    },
                    test: 'ok'
                }
            });
        });
        it('default (req, @Path, @Body - full body)', async () => {
            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Path('id') id: string,
                    @Body() body: string
                ): void {
                    return req.res.json({
                        id,
                        body,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 200,
                body  : {
                    id  : 'a',
                    body: {
                        foo: {
                            obj: 'bar'
                        }
                    },
                    test: 'ok'
                }
            });
        });
    });

    describe('Session', () => {
        let app: App;

        beforeEach(() => {
            Injector.reset();
        });

        afterEach(async () => {
            await app.server.close();
        });

        describe('Session id', () => {
            // TODO docs about writing middleware
            it('without session', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, res: Response): void {
                        res.json({
                            session_id: req.session_id,
                            session   : req.session
                        });
                    }
                }

                app = createApp(App);
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo'
                );
                should(result).eql({
                    status: 200,
                    body  : {}
                });
            });

            it('sessionFromHeader', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, res: Response): void {
                        res.session_id = 'changed_session_id';
                        res.json({
                            session_id: req.session_id
                        });
                    }
                }

                app = createApp(App);
                app.server.setSessionStorage(
                    sessionFromHeader(),
                    SessionStorageInMemory
                );
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo',
                    {},
                    {
                        headers: {
                            Authorization: 'Bearer 935ddceb2f6bbbb78363b224099f75c8'
                        }
                    }
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: '935ddceb2f6bbbb78363b224099f75c8'
                    }
                });
            });

            it('sessionFromCookie', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, res: Response): void {
                        res.session_id = 'changed_session_id';
                        res.json({
                            session_id: req.session_id
                        });
                    }
                }

                app = createApp(App);
                app.server.setSessionStorage(
                    sessionFromCookie(),
                    SessionStorageInMemory
                );
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo',
                    {},
                    {
                        headers: {
                            Cookie: 'session=935ddceb2f6bbbb78363b224099f75c8'
                        }
                    }
                );
                should(result).eql({
                    status : 200,
                    headers: {
                        cookie: {
                            session: 'changed_session_id'
                        }
                    },
                    body   : {
                        session_id: '935ddceb2f6bbbb78363b224099f75c8'
                    }
                });
            });

            it('in-memory session', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action(['get', 'put'], '/')
                    public index(req: Request, res: Response): void {
                        if (req.body)
                            res.session.set(req.body);
                        res.session.set('changed', true);
                        res.json({
                            session_id: req.session_id,
                            session   : req.session
                        });
                    }
                }

                app = createApp(App);
                app.server.setSessionStorage(
                    sessionFromHeader(),
                    SessionStorageInMemory
                );
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/',
                    {
                        foo: 'bar'
                    },
                    {
                        headers: {
                            Authorization: 'Bearer 935ddceb2f6bbbb78363b224099f75c8'
                        }
                    }
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: '935ddceb2f6bbbb78363b224099f75c8',
                        session   : {}
                    }
                });

                const result2 = await fetch(
                    'get',
                    'http://127.0.0.1:3000/test/',
                    null,
                    {
                        headers: {
                            Authorization: 'Bearer 935ddceb2f6bbbb78363b224099f75c8'
                        }
                    }
                );
                should(result2).eql({
                    status: 200,
                    body  : {
                        session_id: '935ddceb2f6bbbb78363b224099f75c8',
                        session   : {
                            foo    : 'bar',
                            changed: true
                        }
                    }
                });
            });

            it('default (req, @Session())', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, @Session() session: any): void {
                        req.res.json({
                            session_id: req.session_id,
                            session
                        });
                    }
                }

                app = createApp(App);
                app.server.setSessionStorage(
                    sessionFromHeader(),
                    SessionStorageInMemory
                );
                app.server.sessionStorage['storage']['SESSION_ID'] = {
                    foo: 'bar'
                };
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo',
                    null,
                    {
                        headers: {
                            Authorization: 'Bearer SESSION_ID'
                        }
                    }
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: 'SESSION_ID',
                        session   : {
                            foo: 'bar'
                        }
                    }
                });
            });

            it('default (req, @Session(_))', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, @Session('foo') foo: any): void {
                        req.res.json({
                            session_id: req.session_id,
                            foo
                        });
                    }
                }

                app = createApp(App);
                app.server.setSessionStorage(
                    sessionFromHeader(),
                    SessionStorageInMemory
                );
                app.server.sessionStorage['storage']['SESSION_ID'] = {
                    foo: 'bar'
                };
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo',
                    null,
                    {
                        headers: {
                            Authorization: 'Bearer SESSION_ID'
                        }
                    }
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: 'SESSION_ID',
                        foo       : 'bar'
                    }
                });
            });
        });

        describe('Check session', () => {
            function mockSession() {
                return (req: Request, res: Response, next: any) => {
                    req.session_id = 'SESSION_ID';
                    req.session    = {
                        foo: 'bar'
                    };
                    const ret      = next();
                    console.log('ASDASDAS', typeof ret, ret);
                };
            }

            it('without session', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, res: Response): void {
                        res.json({
                            session_id: req.session_id,
                            session   : req.session
                        });
                    }
                }

                app = createApp(App);
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo'
                );
                should(result).eql({
                    status: 200,
                    body  : {}
                });
            });

            it('in-memory session', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, res: Response): void {
                        res.json({
                            session_id: req.session_id,
                            session   : req.session
                        });
                    }
                }

                app = createApp(App);
                app.server.use(mockSession());
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo'
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: 'SESSION_ID',
                        session   : {
                            foo: 'bar'
                        }
                    }
                });
            });

            it('default (req, @Session())', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, @Session() session: any): void {
                        req.res.json({
                            session_id: req.session_id,
                            session
                        });
                    }
                }

                app = createApp(App);
                app.server.use(mockSession());
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo'
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: 'SESSION_ID',
                        session   : {
                            foo: 'bar'
                        }
                    }
                });
            });

            it('default (req, @Session(_))', async () => {
                @Controller('Test controller')
                class TestController {
                    @Action('put', '/:id')
                    public index(req: Request, @Session('foo') foo: string): void {
                        req.res.json({
                            session_id: req.session_id,
                            foo
                        });
                    }
                }

                app = createApp(App);
                app.server.use(mockSession());
                app.server.registerController('/test', TestController);
                await app.server.listen(3000);

                const result = await fetch(
                    'put',
                    'http://127.0.0.1:3000/test/a?foo=foo'
                );
                should(result).eql({
                    status: 200,
                    body  : {
                        session_id: 'SESSION_ID',
                        foo       : 'bar'
                    }
                });
            });
        });
    });

    describe('Entity in params', () => {
        let app: App;

        beforeEach(() => {
            Injector.reset();
        });

        afterEach(async () => {
            await app.server.close();
        });

        it('Sync getter (req, @Entity @Path, @Body)', async () => {
            class Test {
                public static findByPk(id: string): Test {
                    return new Test({ id });
                }

                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(Test) @Path('id') path: string,
                    @Body('foo') foo: string
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 200,
                body  : {
                    path: {
                        id: 'a'
                    },
                    foo : {
                        obj: 'bar'
                    },
                    test: 'ok'
                }
            });
        });
        it('Promise (req, @Entity @Path, @Body)', async () => {
            class Test {
                public static findByPk(id: string): Promise<Test> {
                    return new Promise<Test>((resolve, reject) => {
                        setTimeout(() => resolve(new Test({ id })), 10);
                    });
                }

                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(Test) @Path('id') path: string,
                    @Body('foo') foo: string
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 200,
                body  : {
                    path: {
                        id: 'a'
                    },
                    foo : {
                        obj: 'bar'
                    },
                    test: 'ok'
                }
            });
        });
        it('Promise - unhandled error (req, @Entity @Path, @Body)', async () => {
            class Test {
                public static findByPk(id: string): Promise<Test> {
                    return new Promise<Test>((resolve, reject) => {
                        setTimeout(() => reject('Not found'), 10);
                    });
                }

                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(Test) @Path('id') path: string,
                    @Body('foo') foo: string
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 404,
                body  : 'Not found'
            });
        });
        it('Promise - handled error (req, @Entity @Path, @Body)', async () => {
            class Test {
                public static findByPk(id: string): Promise<Test> {
                    return new Promise<Test>((resolve, reject) => {
                        setTimeout(() => reject('Invalid ID'), 10);
                    });
                }

                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(Test) @Path('id') path: Test,
                    @Body('foo') foo: object
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }

                public error(
                    _: Request,
                    res: Response,
                    error: EntityError
                ): void {
                    res.status(400).json({
                        error : error.message,
                        action: error.meta.action,
                        params: error.params
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 400,
                body  : {
                    error : 'Invalid ID',
                    action: 'index',
                    params: ['[request]', 'a', { obj: 'bar' }]
                }
            });
        });
        it('error before create Promise - handled error (req, @Entity @Path, @Body)', async () => {
            class TError extends Error {
                public details: string = 'some details';
            }

            class Test {
                public static findByPk(id: string): Promise<Test> {
                    throw new TError('Test error');

                    return new Promise<Test>((resolve, reject) => {
                        setTimeout(() => reject('Invalid ID'), 10);
                    });
                }

                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(Test) @Path('id') path: Test,
                    @Body('foo') foo: object
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }

                public error(
                    _: Request,
                    res: Response,
                    error: EntityError
                ): void {
                    res.status(400).json({
                        error  : error.message,
                        details: error['details'],
                        action : error.meta.action,
                        params : error.params
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 400,
                body  : {
                    error  : 'Test error',
                    details: 'some details',
                    action : 'index',
                    params : ['[request]', 'a', { obj: 'bar' }]
                }
            });
        });
        it('function - handled error (req, @Entity @Path, @Body)', async () => {
            function findByPk(id: string): Promise<Test> {
                return new Promise<Test>((resolve, reject) => {
                    setTimeout(() => reject('Invalid ID'), 10);
                });
            }

            class Test {
                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(findByPk) @Path('id') path: Test,
                    @Body('foo') foo: object
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }

                public error(
                    _: Request,
                    res: Response,
                    error: EntityError
                ): void {
                    res.status(400).json({
                        error : error.message,
                        action: error.meta.action,
                        params: error.params
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 400,
                body  : {
                    error : 'Invalid ID',
                    action: 'index',
                    params: ['[request]', 'a', { obj: 'bar' }]
                }
            });
        });
        it('error in function - handled error (req, @Entity @Path, @Body)', async () => {
            function findByPk(id: string): Promise<Test> {
                throw new Error('throw error');

                return new Promise<Test>((resolve, reject) => {
                    setTimeout(() => reject('Invalid ID'), 10);
                });
            }

            class Test {
                public id: string;

                constructor(data?: any) {
                    Object.assign(this, data);
                }
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(findByPk) @Path('id') path: Test,
                    @Body('foo') foo: object
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }

                public error(
                    _: Request,
                    res: Response,
                    error: EntityError
                ): void {
                    res.status(400).json({
                        error : error.message,
                        action: error.meta.action,
                        params: error.params
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 400,
                body  : {
                    error : 'throw error',
                    action: 'index',
                    params: ['[request]', 'a', { obj: 'bar' }]
                }
            });
        });
        it('real error in promise function - handled error (req, @Entity @Path, @Body)', async () => {
            function findByPk(id: string): Promise<string> {
                return new Promise(resolve => {
                    const g: string = null;
                    resolve(g.substr(0, 10));
                });
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(findByPk) @Path('id') path: string,
                    @Body('foo') foo: object
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }

                public error(
                    _: Request,
                    res: Response,
                    error: EntityError
                ): void {
                    res.status(400).json({
                        error : error.message,
                        action: error.meta.action,
                        params: error.params
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 400,
                body  : {
                    error : 'Cannot read property \'substr\' of null',
                    action: 'index',
                    params: ['[request]', 'a', { obj: 'bar' }]
                }
            });
        });
        it('real error in function - handled error (req, @Entity @Path, @Body)', async () => {
            function findByPk(id: string): string {
                const g: string = null;
                return g.substr(0, 10);
            }

            @Controller('Test controller')
            class TestController {
                @Action('patch', '/:id')
                public index(
                    req: any,
                    @Entity(findByPk) @Path('id') path: string,
                    @Body('foo') foo: object
                ): void {
                    return req.res.json({
                        path,
                        foo,
                        test: 'ok'
                    });
                }

                public error(
                    req: Request,
                    res: Response,
                    error: EntityError
                ): void {
                    res.status(400).json({
                        error : error.message,
                        action: error.meta.action,
                        params: error.params
                    });
                }
            }

            app = createApp(App);
            app.server.registerController('/test', TestController);
            await app.server.listen(3000);

            const result = await fetch(
                'patch',
                'http://127.0.0.1:3000/test/a',
                {
                    foo: {
                        obj: 'bar'
                    }
                }
            );
            should(result).eql({
                status: 400,
                body  : {
                    action: 'index',
                    error : 'Cannot read property \'substr\' of null',
                    params: ['[request]', 'a', { obj: 'bar' }]
                }
            });
        });
    });
});
