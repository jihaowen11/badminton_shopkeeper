/**
 * 建表兜底
 *
 * 模型文件里的 `model.sync()` 是一个游离的 Promise：数据库没起来、或老库结构对不上时它会 reject。
 * Node 15+ 对未处理的 Promise 拒绝默认是直接退出进程——启动瞬间的一次抖动不该把服务整个打挂，
 * 所以统一在这里吞掉异常并留一条日志，后续接口报错时能顺着这条日志定位。
 */
function safeSync(model, label) {
    if (!model || typeof model.sync !== 'function') return Promise.resolve(null);
    return model.sync({ force: false }).catch((err) => {
        console.error(
            `[db] ${label || '表'} 建表/同步未完成：`,
            err && err.message ? err.message : err
        );
        return null;
    });
}

module.exports = { safeSync };
