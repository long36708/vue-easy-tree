<template>
  <div
    v-observe-visibility="handleVisibilityChange"
    class="vue-recycle-scroller"
    :class="{
      ready,
      'page-mode': pageMode,
      [`direction-${direction}`]: true,
    }"
    @scroll.passive="handleScroll"
  >
    <div
      v-if="$slots.before"
      ref="before"
      class="vue-recycle-scroller__slot"
    >
      <slot
        name="before"
      />
    </div>

    <component
      :is="listTag"
      ref="wrapper"
      :style="{ [direction === 'vertical' ? 'minHeight' : 'minWidth']: totalSize + 'px' }"
      class="vue-recycle-scroller__item-wrapper"
      :class="listClass"
    >
      <component
        :is="itemTag"
        v-for="view of pool"
        :key="view.nr.id"
        :style="ready ? {
          transform: `translate${direction === 'vertical' ? 'Y' : 'X'}(${view.position}px) translate${direction === 'vertical' ? 'X' : 'Y'}(${view.offset}px)`,
          width: gridItems ? `${direction === 'vertical' ? itemSecondarySize || itemSize : itemSize}px` : undefined,
          height: gridItems ? `${direction === 'horizontal' ? itemSecondarySize || itemSize : itemSize}px` : undefined,
        } : null"
        class="vue-recycle-scroller__item-view"
        :class="[
          itemClass,
          {
            hover: !skipHover && hoverKey === view.nr.key
          },
        ]"
        v-on="skipHover ? {} : {
          mouseenter: () => { hoverKey = view.nr.key },
          mouseleave: () => { hoverKey = null },
        }"
      >
        <slot
          :item="view.item"
          :index="view.nr.index"
          :active="view.nr.used"
        />
      </component>

      <slot
        name="empty"
      />
    </component>

    <div
      v-if="$slots.after"
      ref="after"
      class="vue-recycle-scroller__slot"
    >
      <slot
        name="after"
      />
    </div>

    <ResizeObserver @notify="handleResize" />
  </div>
</template>

<script>
import { ResizeObserver } from 'vue-resize'
import { ObserveVisibility } from 'vue-observe-visibility'
import ScrollParent from 'scrollparent'
import config from '../config'
import { props, simpleArray } from './common'
import { supportsPassive } from '../utils'

let uid = 0

export default {
  name: 'RecycleScroller',

  components: {
    ResizeObserver,
  },

  directives: {
    ObserveVisibility,
  },

  props: {
    ...props,

    itemSize: {
      type: Number,
      default: null,
    },

    gridItems: {
      type: Number,
      default: undefined,
    },

    itemSecondarySize: {
      type: Number,
      default: undefined,
    },

    minItemSize: {
      type: [Number, String],
      default: null,
    },

    sizeField: {
      type: String,
      default: 'size',
    },

    typeField: {
      type: String,
      default: 'type',
    },

    buffer: {
      type: Number,
      default: 200,
    },

    pageMode: {
      type: Boolean,
      default: false,
    },

    prerender: {
      type: Number,
      default: 0,
    },

    emitUpdate: {
      type: Boolean,
      default: false,
    },

    skipHover: {
      type: Boolean,
      default: false,
    },

    listTag: {
      type: String,
      default: 'div',
    },

    itemTag: {
      type: String,
      default: 'div',
    },

    listClass: {
      type: [String, Object, Array],
      default: '',
    },

    itemClass: {
      type: [String, Object, Array],
      default: '',
    },

    updateInterval: {
      type: Number,
      default: 0,
    },
  },

  data () {
    return {
      pool: [],
      totalSize: 0,
      ready: false,
      hoverKey: null,
    }
  },

  computed: {
    sizes () {
      if (this.itemSize === null) {
        const sizes = {
          '-1': { accumulator: 0 },
        }
        const items = this.items
        const field = this.sizeField
        const minItemSize = this.minItemSize
        let computedMinSize = 10000
        let accumulator = 0
        let current
        for (let i = 0, l = items.length; i < l; i++) {
          current = items[i][field] || minItemSize
          if (current < computedMinSize) {
            computedMinSize = current
          }
          accumulator += current
          sizes[i] = { accumulator, size: current }
        }
        // eslint-disable-next-line
        this.$_computedMinItemSize = computedMinSize
        return sizes
      }
      return []
    },

    simpleArray,
  },

  watch: {
    items () {
      this.updateVisibleItems(true)
    },

    pageMode () {
      this.applyPageMode()
      this.updateVisibleItems(false)
    },

    sizes: {
      handler () {
        this.updateVisibleItems(false)
      },
      deep: true,
    },

    gridItems () {
      this.updateVisibleItems(true)
    },

    itemSecondarySize () {
      this.updateVisibleItems(true)
    },
  },

  created () {
    this.$_startIndex = 0
    this.$_endIndex = 0
    this.$_views = new Map()
    this.$_unusedViews = new Map()
    this.$_scrollDirty = false
    this.$_lastUpdateScrollPosition = 0

    // In SSR mode, we also prerender the same number of item for the first render
    // to avoir mismatch between server and client templates
    if (this.prerender) {
      this.$_prerender = true
      this.updateVisibleItems(false)
    }

    if (this.gridItems && !this.itemSize) {
      console.error('[vue-recycle-scroller] You must provide an itemSize when using gridItems')
    }
  },

  mounted () {
    this.applyPageMode()
    this.$nextTick(() => {
      // In SSR mode, render the real number of visible items
      this.$_prerender = false
      this.updateVisibleItems(true)
      this.ready = true
    })
  },

  activated () {
    const lastPosition = this.$_lastUpdateScrollPosition
    if (typeof lastPosition === 'number') {
      this.$nextTick(() => {
        this.scrollToPosition(lastPosition)
      })
    }
  },

  beforeDestroy () {
    this.removeListeners()
  },

  methods: {
    addView (pool, index, item, key, type) {
      const view = {
        item,
        position: 0,
      }
      const nonReactive = {
        id: uid++,
        index,
        used: true,
        key,
        type,
      }
      Object.defineProperty(view, 'nr', {
        configurable: false,
        value: nonReactive,
      })
      pool.push(view)
      return view
    },

    unuseView (view, fake = false) {
      const unusedViews = this.$_unusedViews
      const type = view.nr.type
      let unusedPool = unusedViews.get(type)
      if (!unusedPool) {
        unusedPool = []
        unusedViews.set(type, unusedPool)
      }
      unusedPool.push(view)
      if (!fake) {
        view.nr.used = false
        view.position = -9999
        this.$_views.delete(view.nr.key)
      }
    },

    handleResize () {
      this.$emit('resize')
      if (this.ready) this.updateVisibleItems(false)
    },

    handleScroll (event) {
      if (!this.$_scrollDirty) {
        this.$_scrollDirty = true
        if (this.$_updateTimeout) return

        const requestUpdate = () => requestAnimationFrame(() => {
          this.$_scrollDirty = false
          const { continuous } = this.updateVisibleItems(false, true)

          // It seems sometimes chrome doesn't fire scroll event :/
          // When non continous scrolling is ending, we force a refresh
          if (!continuous) {
            clearTimeout(this.$_refreshTimout)
            this.$_refreshTimout = setTimeout(this.handleScroll, this.updateInterval + 100)
          }
        })

        requestUpdate()
        // Schedule the next update with throttling
        if (this.updateInterval) {
          this.$_updateTimeout = setTimeout(() => {
            this.$_updateTimeout = 0
            if (this.$_scrollDirty) requestUpdate()
          }, this.updateInterval)
        }
      }
    },

    handleVisibilityChange (isVisible, entry) {
      if (this.ready) {
        if (isVisible || entry.boundingClientRect.width !== 0 || entry.boundingClientRect.height !== 0) {
          this.$emit('visible')
          requestAnimationFrame(() => {
            this.updateVisibleItems(false)
          })
        } else {
          this.$emit('hidden')
        }
      }
    },

    updateVisibleItems (checkItem, checkPositionDiff = false) {
      const itemSize = this.itemSize
      const gridItems = this.gridItems || 1
      const itemSecondarySize = this.itemSecondarySize || itemSize
      const minItemSize = this.$_computedMinItemSize
      const typeField = this.typeField
      const keyField = this.simpleArray ? null : this.keyField
      const items = this.items
      const count = items.length
      const sizes = this.sizes
      const views = this.$_views
      const unusedViews = this.$_unusedViews
      const pool = this.pool
      let startIndex, endIndex
      let totalSize
      let visibleStartIndex, visibleEndIndex

      if (!count) {
        startIndex = endIndex = visibleStartIndex = visibleEndIndex = totalSize = 0
      } else if (this.$_prerender) {
        startIndex = visibleStartIndex = 0
        endIndex = visibleEndIndex = Math.min(this.prerender, items.length)
        totalSize = null
      } else {
        const scroll = this.getScroll()

        // Skip update if use hasn't scrolled enough
        if (checkPositionDiff) {
          let positionDiff = scroll.start - this.$_lastUpdateScrollPosition
          if (positionDiff < 0) positionDiff = -positionDiff
          if ((itemSize === null && positionDiff < minItemSize) || positionDiff < itemSize) {
            return {
              continuous: true,
            }
          }
        }
        this.$_lastUpdateScrollPosition = scroll.start

        const buffer = this.buffer
        scroll.start -= buffer
        scroll.end += buffer

        // account for leading slot
        let beforeSize = 0
        if (this.$refs.before) {
          beforeSize = this.$refs.before.scrollHeight
          scroll.start -= beforeSize
        }

        // account for trailing slot
        if (this.$refs.after) {
          const afterSize = this.$refs.after.scrollHeight
          scroll.end += afterSize
        }

        // Variable size mode
        if (itemSize === null) {
          let h
          let a = 0
          let b = count - 1
          let i = ~~(count / 2)
          let oldI

          // Searching for startIndex
          do {
            oldI = i
            h = sizes[i].accumulator
            if (h < scroll.start) {
              a = i
            } else if (i < count - 1 && sizes[i + 1].accumulator > scroll.start) {
              b = i
            }
            i = ~~((a + b) / 2)
          } while (i !== oldI)
          i < 0 && (i = 0)
          startIndex = i

          // For container style
          totalSize = sizes[count - 1].accumulator

          // Searching for endIndex
          for (endIndex = i; endIndex < count && sizes[endIndex].accumulator < scroll.end; endIndex++);
          if (endIndex === -1) {
            endIndex = items.length - 1
          } else {
            endIndex++
            // Bounds
            endIndex > count && (endIndex = count)
          }

          // search visible startIndex
          for (visibleStartIndex = startIndex; visibleStartIndex < count && (beforeSize + sizes[visibleStartIndex].accumulator) < scroll.start; visibleStartIndex++);

          // search visible endIndex
          for (visibleEndIndex = visibleStartIndex; visibleEndIndex < count && (beforeSize + sizes[visibleEndIndex].accumulator) < scroll.end; visibleEndIndex++);
        } else {
          // Fixed size mode
          startIndex = ~~(scroll.start / itemSize * gridItems)
          const remainer = startIndex % gridItems
          startIndex -= remainer
          endIndex = Math.ceil(scroll.end / itemSize * gridItems)
          visibleStartIndex = Math.max(0, Math.floor((scroll.start - beforeSize) / itemSize * gridItems))
          visibleEndIndex = Math.floor((scroll.end - beforeSize) / itemSize * gridItems)

          // Bounds
          startIndex < 0 && (startIndex = 0)
          endIndex > count && (endIndex = count)
          visibleStartIndex < 0 && (visibleStartIndex = 0)
          visibleEndIndex > count && (visibleEndIndex = count)

          totalSize = Math.ceil(count / gridItems) * itemSize
        }
      }

      if (endIndex - startIndex > config.itemsLimit) {
        this.itemsLimitError()
      }

      this.totalSize = totalSize

      let view

      const continuous = startIndex <= this.$_endIndex && endIndex >= this.$_startIndex

      if (this.$_continuous !== continuous) {
        if (continuous) {
          views.clear()
          unusedViews.clear()
          for (let i = 0, l = pool.length; i < l; i++) {
            view = pool[i]
            this.unuseView(view)
          }
        }
        this.$_continuous = continuous
      } else if (continuous) {
        for (let i = 0, l = pool.length; i < l; i++) {
          view = pool[i]
          if (view.nr.used) {
            // Update view item index
            if (checkItem) {
              view.nr.index = items.indexOf(view.item)
            }

            // Check if index is still in visible range
            if (
              view.nr.index === -1 ||
              view.nr.index < startIndex ||
              view.nr.index >= endIndex
            ) {
              this.unuseView(view)
            }
          }
        }
      }

      const unusedIndex = continuous ? null : new Map()

      let item, type, unusedPool
      let v
      for (let i = startIndex; i < endIndex; i++) {
        item = items[i]
        const key = keyField ? item[keyField] : item
        if (key == null) {
          throw new Error(`Key is ${key} on item (keyField is '${keyField}')`)
        }
        view = views.get(key)

        if (!itemSize && !sizes[i].size) {
          if (view) this.unuseView(view)
          continue
        }

        // No view assigned to item
        if (!view) {
          if (i === items.length - 1) this.$emit('scroll-end')
          if (i === 0) this.$emit('scroll-start')

          type = item[typeField]
          unusedPool = unusedViews.get(type)

          if (continuous) {
            // Reuse existing view
            if (unusedPool && unusedPool.length) {
              view = unusedPool.pop()
              view.item = item
              view.nr.used = true
              view.nr.index = i
              view.nr.key = key
              view.nr.type = type
            } else {
              view = this.addView(pool, i, item, key, type)
            }
          } else {
            // Use existing view
            // We don't care if they are already used
            // because we are not in continous scrolling
            v = unusedIndex.get(type) || 0

            if (!unusedPool || v >= unusedPool.length) {
              view = this.addView(pool, i, item, key, type)
              this.unuseView(view, true)
              unusedPool = unusedViews.get(type)
            }

            view = unusedPool[v]
            view.item = item
            view.nr.used = true
            view.nr.index = i
            view.nr.key = key
            view.nr.type = type
            unusedIndex.set(type, v + 1)
            v++
          }
          views.set(key, view)
        } else {
          view.nr.used = true
          view.item = item
        }

        // Update position
        if (itemSize === null) {
          view.position = sizes[i - 1].accumulator
          view.offset = 0
        } else {
          view.position = Math.floor(i / gridItems) * itemSize
          view.offset = (i % gridItems) * itemSecondarySize
        }
      }

      this.$_startIndex = startIndex
      this.$_endIndex = endIndex

      if (this.emitUpdate) this.$emit('update', startIndex, endIndex, visibleStartIndex, visibleEndIndex)

      // After the user has finished scrolling
      // Sort views so text selection is correct
      clearTimeout(this.$_sortTimer)
      this.$_sortTimer = setTimeout(this.sortViews, this.updateInterval + 300)

      return {
        continuous,
      }
    },

    getListenerTarget () {
      let target = ScrollParent(this.$el)
      // Fix global scroll target for Chrome and Safari
      if (window.document && (target === window.document.documentElement || target === window.document.body)) {
        target = window
      }
      return target
    },

    getScroll () {
      const { $el: el, direction } = this
      const isVertical = direction === 'vertical'
      let scrollState

      if (this.pageMode) {
        const bounds = el.getBoundingClientRect()
        const boundsSize = isVertical ? bounds.height : bounds.width
        let start = -(isVertical ? bounds.top : bounds.left)
        let size = isVertical ? window.innerHeight : window.innerWidth
        if (start < 0) {
          size += start
          start = 0
        }
        if (start + size > boundsSize) {
          size = boundsSize - start
        }
        scrollState = {
          start,
          end: start + size,
        }
      } else if (isVertical) {
        scrollState = {
          start: el.scrollTop,
          end: el.scrollTop + el.clientHeight,
        }
      } else {
        scrollState = {
          start: el.scrollLeft,
          end: el.scrollLeft + el.clientWidth,
        }
      }

      return scrollState
    },

    applyPageMode () {
      if (this.pageMode) {
        this.addListeners()
      } else {
        this.removeListeners()
      }
    },

    addListeners () {
      this.listenerTarget = this.getListenerTarget()
      this.listenerTarget.addEventListener('scroll', this.handleScroll, supportsPassive
        ? {
            passive: true,
          }
        : false)
      this.listenerTarget.addEventListener('resize', this.handleResize)
    },

    removeListeners () {
      if (!this.listenerTarget) {
        return
      }

      this.listenerTarget.removeEventListener('scroll', this.handleScroll)
      this.listenerTarget.removeEventListener('resize', this.handleResize)

      this.listenerTarget = null
    },

    scrollToItem (index) {
      let scroll
      if (this.itemSize === null) {
        scroll = index > 0 ? this.sizes[index - 1].accumulator : 0
      } else {
        scroll = Math.floor(index / this.gridItems) * this.itemSize
      }
      this.scrollToPosition(scroll)
    },

    scrollToPosition (position) {
      const direction = this.direction === 'vertical'
        ? { scroll: 'scrollTop', start: 'top' }
        : { scroll: 'scrollLeft', start: 'left' }

      let viewport
      let scrollDirection
      let scrollDistance

      if (this.pageMode) {
        const viewportEl = ScrollParent(this.$el)
        // HTML doesn't overflow like other elements
        const scrollTop = viewportEl.tagName === 'HTML' ? 0 : viewportEl[direction.scroll]
        const bounds = viewportEl.getBoundingClientRect()

        const scroller = this.$el.getBoundingClientRect()
        const scrollerPosition = scroller[direction.start] - bounds[direction.start]

        viewport = viewportEl
        scrollDirection = direction.scroll
        scrollDistance = position + scrollTop + scrollerPosition
      } else {
        viewport = this.$el
        scrollDirection = direction.scroll
        scrollDistance = position
      }

      viewport[scrollDirection] = scrollDistance
    },

    itemsLimitError () {
      setTimeout(() => {
        console.log('It seems the scroller element isn\'t scrolling, so it tries to render all the items at once.', 'Scroller:', this.$el)
        console.log('Make sure the scroller has a fixed height (or width) and \'overflow-y\' (or \'overflow-x\') set to \'auto\' so it can scroll correctly and only render the items visible in the scroll viewport.')
      })
      throw new Error('Rendered items limit reached')
    },

    sortViews () {
      this.pool.sort((viewA, viewB) => viewA.nr.index - viewB.nr.index)
    },
  },
}
</script>

<style>
.vue-recycle-scroller {
  position: relative;
}

.vue-recycle-scroller.direction-vertical:not(.page-mode) {
  overflow-y: auto;
}

.vue-recycle-scroller.direction-horizontal:not(.page-mode) {
  overflow-x: auto;
}

.vue-recycle-scroller.direction-horizontal {
  display: flex;
}

.vue-recycle-scroller__slot {
  flex: auto 0 0;
}

.vue-recycle-scroller__item-wrapper {
  flex: 1;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

.vue-recycle-scroller.ready .vue-recycle-scroller__item-view {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.vue-recycle-scroller.direction-vertical .vue-recycle-scroller__item-wrapper {
  width: 100%;
}

.vue-recycle-scroller.direction-horizontal .vue-recycle-scroller__item-wrapper {
  height: 100%;
}

.vue-recycle-scroller.ready.direction-vertical .vue-recycle-scroller__item-view {
  width: 100%;
}

.vue-recycle-scroller.ready.direction-horizontal .vue-recycle-scroller__item-view {
  height: 100%;
}
</style>
