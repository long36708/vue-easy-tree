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
// import Mock from 'mockjs'
// 这里需要注意userInfo是解构出来的，要一一对应
// const {usersInfo} = Mock.mock({
//   "usersInfo|1000": [ // 表示生成10-20个数据
//     {
//       "id|+1": 1, // 表示id从1开始自增1
//       name: '@cname()', // 生成随机名字固定写法
//       address: '@city(true)', // 传入true表示具体到省份市区
//       email: '@email(163.com)' // 传入163.com表示生成的邮箱以163.com结尾，可自定义
//     }
//   ]
// })
import {mockTreeData} from './utils/index'

const treeData = mockTreeData(6500, 10, 50)
export default {
  data() {
    return {
      props: {
        label: "label",
        children: "children",
      },
      treeData: [],
      checkedKeys: []
    };
  },
  created() {
    // const data = [],
    //   root = 8,
    //   children = 3,
    //   base = 10000;
    // for (let i = 0; i < root; i++) {
    //   data.push({
    //     id: `${i}`,
    //     name: `test-${i}`,
    //     children: [],
    //   });
    //   for (let j = 0; j < children; j++) {
    //     data[i].children.push({
    //       id: `${i}-${j}`,
    //       name: `test-${i}-${j}`,
    //       children: [],
    //     });
    //     for (let k = 0; k < base; k++) {
    //       data[i].children[j].children.push({
    //         id: `${i}-${j}-${k}`,
    //         name: `test-${i}-${j}-${k}`,
    //       });
    //     }
    //   }
    // }
    this.treeData = treeData;
  },
  methods: {
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

