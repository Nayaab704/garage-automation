const relatedQueryBatchSize = 75;

export const partsQueueRelatedDataWarning =
  "Some related details could not load. Refresh to try again.";

function chunkValues(values, batchSize = relatedQueryBatchSize) {
  const batches = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }

  return batches;
}

export async function getQueryRows(query) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getChunkedQueryRows(ids, createQuery) {
  const batches = chunkValues(ids);
  const results = await Promise.allSettled(
    batches.map((batch) => getQueryRows(createQuery(batch)))
  );
  const data = [];
  const failures = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(...result.value);
      return;
    }

    const batch = batches[index];
    failures.push({
      batchNumber: index + 1,
      batchSize: batch.length,
      error: result.reason,
      firstId: batch[0] ?? null,
      lastId: batch.at(-1) ?? null,
    });
  });

  return { data, failures };
}

export async function loadRelatedDatasets(loaders) {
  const results = await Promise.allSettled(
    loaders.map((loader) => loader.load())
  );
  const data = {};
  let hadFailures = false;

  results.forEach((result, index) => {
    const loader = loaders[index];

    if (result.status === "rejected") {
      hadFailures = true;
      data[loader.key] = [];
      console.error(`Parts Queue related query failed: ${loader.label}`, {
        error: result.reason,
        relation: loader.label,
      });
      return;
    }

    if (Array.isArray(result.value)) {
      data[loader.key] = result.value;
      return;
    }

    data[loader.key] = result.value.data ?? [];

    for (const failure of result.value.failures ?? []) {
      hadFailures = true;
      console.error(
        `Parts Queue related query batch failed: ${loader.label}`,
        {
          ...failure,
          relation: loader.label,
        }
      );
    }
  });

  return { data, hadFailures };
}
