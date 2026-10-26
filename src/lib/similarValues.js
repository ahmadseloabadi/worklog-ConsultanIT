export function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editSimilarity(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index];
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

export function areComparableTexts(left, right) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftWords = normalizedLeft.split(" ");
  const rightWords = normalizedRight.split(" ");
  if (leftWords.length !== rightWords.length) return false;

  let changedWordCount = 0;
  for (let index = 0; index < leftWords.length; index += 1) {
    if (leftWords[index] === rightWords[index]) continue;
    if (
      Math.min(leftWords[index].length, rightWords[index].length) < 5 ||
      editSimilarity(leftWords[index], rightWords[index]) < 0.8
    ) return false;
    changedWordCount += 1;
    if (changedWordCount > 1) return false;
  }
  return changedWordCount === 1;
}

export function findSimilarValueGroups(reports, field) {
  const values = [...new Set(reports.map((report) => report[field]).filter((value) => value?.trim()))];
  const parents = values.map((_, index) => index);
  const findRoot = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };

  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
      if (!areComparableTexts(values[leftIndex], values[rightIndex])) continue;
      const leftRoot = findRoot(leftIndex);
      const rightRoot = findRoot(rightIndex);
      if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
    }
  }

  const groups = new Map();
  values.forEach((value, index) => {
    const root = findRoot(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(value);
  });
  return [...groups.values()].filter((variants) => variants.length > 1);
}
