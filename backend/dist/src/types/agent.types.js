"use strict";
// Agent Types and Interfaces
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentType = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PLANNING"] = "planning";
    TaskStatus["EXECUTING"] = "executing";
    TaskStatus["REASONING"] = "reasoning";
    TaskStatus["VERIFYING"] = "verifying";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var AgentType;
(function (AgentType) {
    AgentType["COORDINATOR"] = "coordinator";
    AgentType["MARKET_MONITOR"] = "market_monitor";
    AgentType["NEWS_SENTIMENT"] = "news_sentiment";
    AgentType["ONCHAIN_ANALYSIS"] = "onchain_analysis";
    AgentType["STRATEGY_GENERATOR"] = "strategy_generator";
    AgentType["VISUALIZATION"] = "visualization";
})(AgentType || (exports.AgentType = AgentType = {}));
