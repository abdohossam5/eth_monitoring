var colors = require('colors');
require('console.json');


module.exports = function (env, type, mesg) {
    if (env == 'd') {
        env = 'DB';
    } else if (env == 'w') {
        env = 'WEB';
    } else if (env == 'io') {
        env = 'SOCKET';
    } else if (env == 'sch'){
        env = 'SCHEDULER';
    } else {
        env = 'SERVER';
    }

    if (type == 's') {
        type = colors.green('success:');
    } else if (type == 'i') {
        type = colors.cyan('info:');
    } else if (type == 'w') {
        type = colors.yellow('warning:');
    } else if (type == 'e') {
        type = colors.red('error:');
    } else if (type == 'd') {
        type = colors.grey('debug:');
    }

    if (typeof mesg == 'object') {
        //mesg = colors.italic(colors.grey(JSON.stringify(mesg)));
        console.log('  '+'['+colors.bold(colors.white(env))+'] '+colors.bold(type));
        console.json('Object', mesg);
        return;
    }

    console.log('  '+'['+colors.bold(colors.white(env))+'] '+colors.bold(type)+' '+mesg);
};
