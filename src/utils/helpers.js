// server/src/utils/helpers.js
export const chunkArray = (arr, size=5) => {
  const out = [];
  for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
};
