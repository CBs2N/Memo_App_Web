// WebSocket 同步入口：具体处理逻辑由调用方传入 onUpdate 回调
// （connectSync、断线重连均由 common.js 提供）
function initSync(onUpdate) {
  connectSync(onUpdate);
}
