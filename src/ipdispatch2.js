

//IP转成整型
function _ip2int(ip) 
{
  var num = 0;
  ip = ip.split(".");
  num = Number(ip[0]) * 256 * 256 * 256 + Number(ip[1]) * 256 * 256 + Number(ip[2]) * 256 + Number(ip[3]);
  num = num >>> 0;
  return num;
}
//整型解析为IP地址
function _int2iP(num) 
{
  var str;
  var tt = new Array();
  tt[0] = (num >>> 24) >>> 0;
  tt[1] = ((num << 8) >>> 24) >>> 0;
  tt[2] = (num << 16) >>> 24;
  tt[3] = (num << 24) >>> 24;
  str = String(tt[0]) + "." + String(tt[1]) + "." + String(tt[2]) + "." + String(tt[3]);
  return str;
}
const ipDispatch=(list_IpRange, splitNum)=>{
    let finalList=[]
    for(let i=0;i<splitNum;i++){
        let oneList=[]
        finalList.push(oneList)
    }
    for(let j=0;j<list_IpRange.length;j++){
        let index=j%splitNum
        finalList[index].push(list_IpRange[j])        
    }
    return finalList

}

module.exports = {
    ipDispatch
}
// let aa=[]
// for(let i=0;i<88;i++){
//     aa.push(i)
// }
// let xx=ipDispatch(aa,5)
// console.log(xx)
