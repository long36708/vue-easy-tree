/**
 * @Author: longmo
 * @Date: 2025-05-14 14:03:40
 * @LastEditTime: 2025-05-14 23:19:36
 * @FilePath: src/utils/index.js
 * @Description:
 */
class Tree {
  constructor(id, label, parentId) {
    this.id = id
    this.label = label + '-' + id
    this.parentId = parentId;
    this.children =[]
  }
}

function generateLeveX(ROOT_ID,count){
  const list = []
  for (let i = 1; i < count; i++) {
    const leve1 = new Tree(i, '一级节点1', ROOT_ID)
    list.push(leve1)
  }
  return list
}
function generateChildren(prefix, label, parentId, count) {
  const children1 = []
  for (let i = 0; i < count; i++) {
    const node = new Tree(`${prefix}${i}`, `${label}${prefix}`, parentId)
    children1.push(node)
  }
  return children1
}
function makeTreeList(){
  const nodes = []
  const ROOT = new Tree(0, '根节点', 99999999)
  const leveList = generateLeveX(ROOT.id,6)
  nodes.push(ROOT,...leveList)

  // const children1 = generateChildren('a', '二级节点', 1, 1)
  // const children2 = generateChildren('aa', '三级节点', 'a0', 2500)
  // const children3 = generateChildren('aaa', '三级节点', 'aa0', 2498)
  // nodes.push(...children1, ...children2,...children3) // 赋值勾选耗时: 18439.720703125 ms

  // const children1 = generateChildren('a', '二级节点', 1, 1)
  // const children2 = generateChildren('aa', '三级节点', 'a0', 1)
  // const children3 = generateChildren('aaa', '三级节点', 'aa0', 4998)
  // nodes.push(...children1, ...children2,...children3) // 赋值勾选耗时: 23596.05810546875 ms

  // const children1 = generateChildren('a', '二级节点', 1, 1)
  // const children2 = generateChildren('aa', '三级节点', 'a0', 4999)
  // nodes.push(...children1, ...children2) // 赋值勾选耗时: 20082.373046875 ms 赋值勾选耗时: 21176.23486328125 ms

  // const children1 = generateChildren('a', '二级节点', 1, 1000)
  // const children2 = generateChildren('b', '二级节点', 2, 1000)
  // const children3 = generateChildren('c', '二级节点', 3, 1000)
  // const children4 = generateChildren('d', '二级节点', 4, 1000)
  // const children5 = generateChildren('e', '二级节点', 5, 1000)
  // nodes.push(...children1, ...children2,...children3,...children4,...children5) // 赋值勾选耗时: 4703.28173828125 ms

  // const children1 = generateChildren('a', '二级节点', 1, 2000)
  // const children2 = generateChildren('b', '二级节点', 2, 3000)
  // nodes.push(...children1, ...children2)

  // const children1 = generateChildren('a', '二级节点', 1, 5000)
  // nodes.push(...children1)

  // 返回最终的节点数
  return nodes;
}
function listToTree(data) {
  // * 先生成parent建立父子关系
  const obj = {};
  data.forEach((item) => {
    obj[item.id] = item;
  });
  // * obj -> {1001: {id: 1001, parentId: 0, name: 'AA'}, 1002: {...}}
  // console.log(obj, "obj")
  const parentList = [];
  data.forEach((item) => {
    const parent = obj[item.parentId];
    if (parent) {
      // * 当前项有父节点
      parent.children = parent.children || [];
      parent.children.push(item);
    } else {
      // * 当前项没有父节点 -> 顶层
      parentList.push(item);
    }
  });
  return parentList;
}
export function mockTreeData(count, min = 5, max = 50) {
  const data = makeTreeList()
  const treeData =  listToTree(data)
  console.log(treeData)
  return treeData
}
