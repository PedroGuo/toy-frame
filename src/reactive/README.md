#### 构建响应式

响应式是我们构建框架其余部分的基础。响应式将定义如何管理状态，以及状态更改时 DOM 如何更新，首先来看下理想情况下代码：

```js
const state = {};

state.a = 1;
state.b = 2;

createEffect(() => {
  state.sum = state.a + state.b;
})

```
想象下我们想要一个 `state` 对象，它有2个属性 `a` 和 `b`，每当这些属性发生变化时，我们都希望 `sum` 重新设置为两者的总和。
假设我们事先不知道它(或者没有编译器来确定它们)的属性，一个普通对象是不够的，因此，让我们使用 `proxy` 来对该对象来进行代理拦截，以便在设置新值时做出反应：

```js

const state = createReactive({});

function createReactive(target) {
  return new Proxy(target, {
    get(obj, prop) {
      onGet(prop)
      return obj[prop]

    },
    set(obj, prop, value) {
      obj[prop] = value
      onSet(prop)
      return true
    }
  })
}

```

现在我们的 `proxy` 没有做任何副作用的请求，除了提供一个 `onGet` 和 `onSet` 钩子外，因此我们在 `onSet` 钩子中设置新值后使用微任务更新

```js

let queued = false;

function onSet(prop) {
  if (!queued) {
      queued = true
      // 创建微任务 它是一个较新的 DOM API，与 Promise.resolve().then(...) 基本相同，但输入量较少
      queueMicrotask(() => {
        queued = false
        flush();
      })
    }
}

```
通过将更新任务进行排队，而不是立即处理它们，这样可以更好地控制和优化更新的执行顺序，这可以提高效率并防止不必要的计算。接下来放 `flush` 更新总和：

```js

function flush() {
 state.sum = state.a + state.b
}

```
以上代码能完成一个简易的响应式，但距离理想情况还有一段差距，因此需要实现 `createEffect`，仅在 `a` 和 `b` 更改时(而非其他属性更改)计算 `sum`。
因此需要一个设计一个对象来记录哪些属性需要被追踪。

```js
const propsToEffects = {};
```
然后就是关键部分了，我们需要确保我们的副作用函数能正确订阅到对应的属性上，因此需要将副作用执行一次以便让他在 `get` 中被收集，并在属性和副作用之间建立映射关系。

我们的副作用函数是这样的：
```js
createEffect(() => {
  state.sum = state.a + state.b
})

```
当它被执行时会调用两个`getter`： `state.a` 和 `state.b`。 这些 getter 应该触发响应式系统，用于告知该副作用函数依赖这两个属性。

为了实现这个，我们使用一个简单的全局对象来暂存当前激活的副作用函数：

```js
let currentEffect;
```
然后在`createEffect`内部在调用该副作用函数之前先设置此激活的副作用值：

```js
function createEffect(effect) {
  currentEffect = effect
  effect()
  currentEffect = undefined
}

```
并在`onGet` 钩子中将当前激活的副作用函数和当前属性之间做一个映射：

```js
function onGet(prop) {
  const effects = propsToEffects[prop] ?? (propsToEffects[prop] = []);
  effects.push(currentEffect);
}

```

运行一次后，`propsToEffects` 结构如下：
```js
{
  "a": [effect],
  "b": [effect]
}
```
其中的 `effect` 就是我们需要的计算求和的副作用函数了。接下来我们在`onSet`钩子中将执行的副作用函数添加到一个待执行的副作用列表`dirtyEffects` 数组中：
```js
 const dirtyEffects = [];

 function onSet(prop) {
  if (propsToEffects[prop]) {
    dirtyEffects.push(...propsToEffects[prop])
    // ...
  }
 }
```
此时，我们已经准备好在`flush` 中调用所有副作用`dirtyEffects`:
```js
 function flush() {
  while(dirtyEffects.length) {
    dirtyEffects.shift()()
  }
 }

```
将上面这些所有的方法放在一起，一个功能齐全的响应式系统就算完成了，但是还需要完善一些 case:

1. 需要配合 `trt catch` 包裹执行 `effect`函数，以防报错。
2. 避免运行相同的效果两次
3. 防止死循环
4. 在后续运行中订阅更新属性的效果（例如，如果仅在 if 块中调用某些 getter）




