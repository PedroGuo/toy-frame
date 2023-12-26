function createReactive(target: Record<keyof any, any>) {
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



const dirtyEffects: Function[] = [];

function flush() {
  while (dirtyEffects.length) {
    const effect = dirtyEffects.shift()!
    effect()
  }
}


let queued = false;
let currentEffect: Function | null = null;

function onSet(prop) {
  if (propsToEffects[prop]) {
    dirtyEffects.push(...propsToEffects[prop])
    if (!queued) {
      queued = true
      // 创建微任务scheduler
      queueMicrotask(() => {
        queued = false
        flush();
      })
    }
  }
}



const propsToEffects: Record<string, Function[]> = {}
function onGet(prop) {
  const effects = propsToEffects[prop] ?? (propsToEffects[prop] = [])
  if (currentEffect) {
    effects.push(currentEffect)
  }
}


function createEffect(effect: Function) {
  currentEffect = effect
  effect()
  currentEffect = null
}




const state: Record<string, any> = createReactive({});

state.a = 1;
state.b = 2;

createEffect(() => {
  state.sum = state.a + state.b

  console.log('state', state)
})
