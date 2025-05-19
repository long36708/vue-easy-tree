<template>
  <div class="ve-tree" style="height: calc(100vh - 20px);display: flex">
    <!--    <h1>Vue-Easy-Tree对比勾选</h1>-->
    <vue-easy-tree
      ref="veTree"
      node-key="id"
      :default-expanded-keys="[0]"
      height="calc(100vh - 20px)"
      :data="treeData"
      :props="props"
      :item-size="26"
      show-checkbox
    >
    </vue-easy-tree>

    <button @click="handleMockData"> 生成假数据</button>
    <button @click="getAllCheckedKeys"> 点击赋值给另一个树</button>

    <vue-easy-tree
      ref="longTree"
      node-key="id"
      :default-expanded-keys="[0]"
      height="calc(100vh - 20px)"
      :data="treeData"
      :props="props"
      :item-size="26"
      show-checkbox
    >
    </vue-easy-tree>
  </div>
</template>

<script>
// import {mockTreeData} from './utils/index'

// const treeData = mockTreeData(6500, 10, 50)
import {mockTreeData} from "./utils/mockTreeData";

const treeData = mockTreeData();
export default {
  data() {
    return {
      props: {
        // label: "label",
        label: "name",
        children: "children",
      },
      treeData: [],
      checkedKeys: []
    };
  },
  created() {

  },
  methods: {
    handleMockData(){
      this.treeData = treeData;
    },
    getAllCheckedKeys() {
      const checkedKeys = this.$refs.veTree.getCheckedKeys();
      console.log('勾选的数据', checkedKeys.length) // 勾选的数据 5006
      // 一级节点分别为2000,3000条数据，赋值勾选耗时: 10983.7060546875 ms
      // 一级节点5000条，赋值勾选耗时: 19636.64501953125 ms
      // 5个一级节点分别为1000、1000、1000、1000、1000时，赋值勾选耗时: 4703.28173828125 ms
      this.checkedKeys = checkedKeys
      const self = this;
      this.$nextTick(() => {
        console.time('赋值勾选耗时')
        checkedKeys.forEach(key => {
          self.$refs.longTree.setChecked(key, true); // 赋值勾选耗时: 10983.7060546875 ms
        })
        // self.$refs.longTree.setCheckedKeys(checkedKeys); //赋值勾选耗时 27492.218017578125 ms
        console.timeEnd('赋值勾选耗时')
      })
    }
  }
};
</script>

<style scoped>
>>> .el-tree {
  width: 40%;
}
</style>

