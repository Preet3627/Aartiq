const { ipcMain } = require('electron');
const { ResearchPipeline } = require('../../lib/research-pipeline.js');

const activePipelines = new Map();

function registerResearchHandlers(ipcMain, handlers) {
  ipcMain.handle('research:start', async (event, { query, engine = 'duckduckgo', options = {} }) => {
    const pipelineId = `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pipeline = new ResearchPipeline({
      concurrency: options.concurrency || 4,
      maxResults: options.maxResults || 12,
      maxContentLength: options.maxContentLength || 12000,
      minContentLength: options.minContentLength || 300,
      similarityThreshold: options.similarityThreshold || 0.7,
      coverageThreshold: options.coverageThreshold || 70,
      maxIterations: options.maxIterations || 4,
    });

    const sendProgress = (progress) => {
      try {
        event.sender.send('research:progress', { pipelineId, ...progress });
      } catch {}
    };

    pipeline.setProgressCallback(sendProgress);
    activePipelines.set(pipelineId, pipeline);

    try {
      const result = await pipeline.run(query, engine);
      activePipelines.delete(pipelineId);
      return { success: true, pipelineId, ...result };
    } catch (error) {
      activePipelines.delete(pipelineId);
      return { success: false, pipelineId, error: error?.message || String(error) || 'Unknown error' };
    }
  });

  ipcMain.handle('research:cancel', async (event, { pipelineId }) => {
    const pipeline = activePipelines.get(pipelineId);
    if (pipeline) {
      pipeline.cancel();
      activePipelines.delete(pipelineId);
      return { success: true };
    }
    return { success: false, error: 'Pipeline not found' };
  });

  ipcMain.handle('research:get-status', async (event, { pipelineId }) => {
    const pipeline = activePipelines.get(pipelineId);
    if (pipeline) {
      return { success: true, running: true };
    }
    return { success: true, running: false };
  });

  ipcMain.handle('research:search-only', async (event, { query, engine = 'duckduckgo', count = 10 }) => {
    try {
      const pipeline = new ResearchPipeline({ maxResults: count });
      const urls = await pipeline.search(query, engine);
      return { success: true, urls: urls.slice(0, count) };
    } catch (error) {
      return { success: false, error: error?.message || String(error) || 'Search failed' };
    }
  });

  console.log('[Handlers] Research pipeline handlers registered');
}

module.exports = registerResearchHandlers;
