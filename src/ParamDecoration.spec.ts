import { Injector, Service } from '@dunai/core';
import { describe, it } from 'mocha';
import should from 'should';
import { Controller } from './controller/Controller';
import {
    addControllerParamDecoration,
    getControllerMetadata,
    IDecoratedParamResolver,
    runMethod
} from './ParamDecoration';

describe('Param decorations', () => {
    describe('useFunction', () => {
        function Value() {
            return addControllerParamDecoration({
                type       : 'value',
                useFunction: (data: { value: number }) => data ? data.value : null
            });
        }

        function Increase(inc = 1) {
            return addControllerParamDecoration({
                type       : 'increase',
                useFunction: (_, value) => value + inc
            });
        }

        function Timeout(pre = 'pre') {
            return addControllerParamDecoration({
                type       : 'timeout',
                useFunction: (_, value) => new Promise(resolve => setTimeout(() => resolve('pre' + value), 100))
            });
        }

        describe('get value', () => {
            it('get value', async () => {
                @Controller()
                class TestCtrl {
                    public one(@Value() num: number) {
                        return num;
                    }
                }

                const test    = new TestCtrl();
                const promise = runMethod(test, 'one')({ value: 10 });
                should(promise.then).Function();
                const result = await promise;
                should(result).eql(10);

                const test2   = new TestCtrl();
                const result2 = await runMethod(test2, 'one')({ value: 20 });
                should(result2).eql(20);
            });
        });

        describe('default value', () => {
            it('default value 1', async () => {
                @Controller()
                class DefaultCtrl {
                    public one(req: string) {
                        return req;
                    }
                }

                const test  = new DefaultCtrl();
                const proto = getControllerMetadata(test as any);

                const result = await runMethod(test, 'one')(null);
                should(result).undefined();

                const test2   = new DefaultCtrl();
                const result2 = await runMethod(test2, 'one')(null, { value: 'req', other: 'foo' }, { another: 'bar' });
                should(result2).eql({ value: 'req', other: 'foo' });
            });

            it('default value 2', async () => {
                @Controller()
                class TestCtrl {
                    public one(req: string, @Value() num: number) {
                        return { req, num };
                    }
                }

                const test2   = new TestCtrl();
                const result2 = await runMethod(test2, 'one')({ value: 20 });
                should(result2).eql({ req: undefined, num: 20 });

                const test   = new TestCtrl();
                const result = await runMethod(test, 'one')({ value: 10 }, 'req');
                should(result).eql({ req: 'req', num: 10 });
            });
        });

        describe('base decorators', () => {
            it('base decorators', async () => {
                @Controller()
                class TestCtrl {
                    public one(@Increase() @Value() num: number) {
                        return num;
                    }

                    public action(@Increase(5) @Value() num: number) {
                        return num;
                    }
                }

                const test   = new TestCtrl();
                const result = await runMethod(test, 'one')({ value: 1 });
                should(result).eql(2);

                const test2   = new TestCtrl();
                const result2 = await runMethod(test2, 'one')({ value: 2 });
                should(result2).eql(3);

                const test3   = new TestCtrl();
                const result3 = await runMethod(test3, 'action')({ value: 1 });
                should(result3).eql(6);

                const test4   = new TestCtrl();
                const result4 = await runMethod(test4, 'action')({ value: 20 });
                should(result4).eql(25);
            });

            it('bad order of decorators 2', async () => {
                @Controller()
                class TestCtrl2 {
                    public one(@Increase(5) num: number) {
                        return num;
                    }

                    public action(@Value() @Increase(5) num: number) {
                        return num;
                    }
                }

                const test2   = new TestCtrl2();
                const result2 = await runMethod(test2, 'one')({ value: 15 });
                should(result2).NaN();

                const test3   = new TestCtrl2();
                const result3 = await runMethod(test3, 'action')({ value: 15 });
                should(result3).eql(15);

                const test4   = new TestCtrl2();
                const result4 = await runMethod(test4, 'action')({ value: 25 });
                should(result4).eql(25);
            });

            it('promise', async () => {
                @Controller()
                class TestCtrl2 {
                    public one(@Timeout('a') @Increase(5) num: number) {
                        return num;
                    }

                    public action(@Value() @Increase(5) num: number) {
                        return num;
                    }
                }

                const test2   = new TestCtrl2();
                const result2 = await runMethod(test2, 'one')({ value: 15 });
                should(result2).eql('preNaN');

                const test3   = new TestCtrl2();
                const result3 = await runMethod(test3, 'action')({ value: 15 });
                should(result3).eql(15);

                const test4   = new TestCtrl2();
                const result4 = await runMethod(test4, 'action')({ value: 25 });
                should(result4).eql(25);
            });
        });
    });

    describe('useClass', () => {
        @Service()
        class CounterService implements IDecoratedParamResolver {
            private count = 0;

            public resolveParam(data: any, value?: any): any {
                this.count++;
                return this.count;
            }
        }

        function Counter() {
            return addControllerParamDecoration({
                type    : 'counter',
                useClass: CounterService
            });
        }

        it('promise', async () => {
            @Controller()
            class TestCtrl2 {
                public one(@Counter() guid: string) {
                    return guid;
                }

                public action(@Counter() guid: string) {
                    return guid;
                }
            }

            const test   = new TestCtrl2();
            const result = await runMethod(test, 'one')({});
            should(result).eql(1);

            const test2   = new TestCtrl2();
            const result2 = await runMethod(test2, 'action')({});
            should(result2).eql(2);

            const test3   = new TestCtrl2();
            const result3 = await runMethod(test3, 'action')({});
            should(result3).eql(3);
        });

    });

    describe('useInstance', () => {
        @Service()
        class CounterService implements IDecoratedParamResolver {
            private count = 0;

            public resolveParam(data: any, value?: any): any {
                this.count++;
                return this.count;
            }
        }

        const counterInstance = new CounterService();

        function Counter() {
            return addControllerParamDecoration({
                type       : 'counter',
                useInstance: counterInstance
            });
        }

        it('promise', async () => {
            @Controller()
            class TestCtrl2 {
                public one(@Counter() guid: string) {
                    return guid;
                }

                public action(@Counter() guid: string) {
                    return guid;
                }
            }

            const test   = new TestCtrl2();
            const result = await runMethod(test, 'one')({});
            should(result).eql(1);

            const test2   = new TestCtrl2();
            const result2 = await runMethod(test2, 'action')({});
            should(result2).eql(2);

            const test3   = new TestCtrl2();
            const result3 = await runMethod(test3, 'action')({});
            should(result3).eql(3);
        });

    });

    describe('useInstance', () => {
        @Service()
        class CounterService implements IDecoratedParamResolver {
            public count = 0;

            public resolveParam(data: any, value?: any): any {
                this.count++;
                return this.count;
            }
        }

        function factory(_, __, index) {
            const counterInstance = new CounterService();
            counterInstance.count = index;
            return counterInstance.resolveParam.bind(counterInstance);
        }

        function Counter() {
            return addControllerParamDecoration({
                type      : 'counter',
                useFactory: factory
            });
        }

        it('promise', async () => {
            @Controller()
            class TestCtrl2 {
                public one(@Counter() guid: string) {
                    return guid;
                }

                public action(_, @Counter() guid: string) {
                    return guid;
                }
            }

            const test   = new TestCtrl2();
            const result = await runMethod(test, 'one')({});
            should(result).eql(1);

            const test4   = new TestCtrl2();
            const result4 = await runMethod(test4, 'one')({});
            should(result4).eql(2);

            const test2   = new TestCtrl2();
            const result2 = await runMethod(test2, 'action')({});
            should(result2).eql(2);

            const test3   = new TestCtrl2();
            const result3 = await runMethod(test3, 'action')({});
            should(result3).eql(3);
        });

    });

    describe('errors', () => {
        function Counter() {
            return addControllerParamDecoration({
                type: 'counter'
            });
        }

        it('invalid decorator', async () => {
            should(() => {
                @Controller()
                class TestCtrl2 {
                    public one(@Counter() guid: string) {
                        return guid;
                    }

                    public action(_, @Counter() guid: string) {
                        return guid;
                    }
                }

                const test   = new TestCtrl2();
                const result = runMethod(test, 'action')({});
            }).throwError('Invalid param decorator in class "TestCtrl2" method "action"');
        });
    });
});
