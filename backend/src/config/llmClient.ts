import OpenAI from 'openai';
import { AzureOpenAI } from 'openai';
import { CONFIG } from './constants';

let _client: OpenAI | null = null;

/**
 * Create the appropriate OpenAI-compatible client based on LLM_PROVIDER.
 *
 * - ollama / nvidia: standard OpenAI client with custom baseURL
 * - azure: AzureOpenAI client with endpoint, API version, and deployment
 *
 * The client is cached as a singleton (all agents share one instance).
 */
export function getLLMClient(): OpenAI {
    if (_client) return _client;

    if (CONFIG.LLM_PROVIDER === 'azure') {
        if (!CONFIG.AZURE_ENDPOINT || !CONFIG.AZURE_API_KEY) {
            throw new Error(
                'Azure OpenAI is not configured. Set AZURE_ENDPOINT and AZURE_API_KEY in .env'
            );
        }
        if (!CONFIG.AZURE_DEPLOYMENT_NAME) {
            throw new Error(
                'Set AZURE_DEPLOYMENT_NAME in .env to your Azure OpenAI deployment name'
            );
        }

        _client = new AzureOpenAI({
            apiKey: CONFIG.AZURE_API_KEY,
            endpoint: CONFIG.AZURE_ENDPOINT,
            apiVersion: CONFIG.AZURE_API_VERSION,
            deployment: CONFIG.AZURE_DEPLOYMENT_NAME,
        });

        console.log(`[LLM] Azure OpenAI client created (deployment: ${CONFIG.AZURE_DEPLOYMENT_NAME})`);
    } else {
        _client = new OpenAI({
            apiKey: CONFIG.LLM_API_KEY,
            baseURL: CONFIG.LLM_BASE_URL,
        });

        console.log(`[LLM] OpenAI-compatible client created (${CONFIG.LLM_PROVIDER}: ${CONFIG.LLM_MODEL})`);
    }

    return _client;
}
