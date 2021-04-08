/*
 * @Author: lxk0301 https://github.com/lxk0301
 * @Date: 2020-08-16 18:54:16
 * @Last Modified by: lxk0301
 * @Last Modified time: 2021-03-09 21:22:37
 */
/*
宠汪汪积分兑换奖品脚本, 目前脚本只兑换京豆，兑换京豆成功，才会发出通知提示，其他情况不通知。
活动入口：京东APP我的-更多工具-宠汪汪
兑换规则：一个账号一天只能兑换一次京豆。
兑换奖品成功后才会有系统弹窗通知
每日京豆库存会在0:00、8:00、16:00更新。
脚本兼容: Quantumult X, Surge, Loon, JSBox, Node.js
==============Quantumult X==============
[task_local]
#宠汪汪积分兑换奖品
0 0-16/8 * * * https://gitee.com/f234419081/jd_scripts/raw/master/jd_joy_reward.js, tag=宠汪汪积分兑换奖品, img-url=https://raw.githubusercontent.com/58xinian/icon/master/jdcww.png, enabled=true

==============Loon==============
[Script]
cron "0 0-16/8 * * *" script-path=https://gitee.com/f234419081/jd_scripts/raw/master/jd_joy_reward.js,tag=宠汪汪积分兑换奖品

================Surge===============
宠汪汪积分兑换奖品 = type=cron,cronexp="0 0-16/8 * * *",wake-system=1,timeout=3600,script-path=https://gitee.com/f234419081/jd_scripts/raw/master/jd_joy_reward.js

===============小火箭==========
宠汪汪积分兑换奖品 = type=cron,script-path=https://gitee.com/f234419081/jd_scripts/raw/master/jd_joy_reward.js, cronexpr="0 0-16/8 * * *", timeout=3600, enable=true
 */
// prettier-ignore
  const $ = new Env('宠汪汪积分兑换奖品');
  let allMessage = '';
  let joyRewardName = 20;//是否兑换京豆，默认开启兑换功能，其中20为兑换20京豆,500为兑换500京豆，0为不兑换京豆.数量有限先到先得
  //Node.js用户请在jdCookie.js处填写京东ck;
  const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
  const notify = $.isNode() ? require('./sendNotify') : '';
  let jdNotify = false;//是否开启静默运行，默认false关闭(即:奖品兑换成功后会发出通知提示)
  //IOS等用户直接用NobyDa的jd cookie
  let cookiesArr = [], cookie = '';
  if ($.isNode()) {
    Object.keys(jdCookieNode).forEach((item) => {
      cookiesArr.push(jdCookieNode[item])
    })
    if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {};
  } else {
    cookiesArr = [$.getdata('CookieJD'), $.getdata('CookieJD2'), ...jsonParse($.getdata('CookiesJD') || "[]").map(item => item.cookie)].filter(item => !!item);
  }
  const JD_API_HOST = 'https://jdjoy.jd.com';
  !(async () => {
    if (!cookiesArr[0]) {
      $.msg('【京东账号一】宠汪汪积分兑换奖品失败', '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/bean/signIndex.action', {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});
    }
    for (let i = 0; i < cookiesArr.length; i++) {
      if (cookiesArr[i]) {
        cookie = cookiesArr[i];
        $.UserName = decodeURIComponent(cookie.match(/pt_pin=(.+?);/) && cookie.match(/pt_pin=(.+?);/)[1])
        $.index = i + 1;
        $.isLogin = true;
        $.nickName = '' || $.UserName;
        await TotalBean();
        console.log(`\n*****开始【京东账号${$.index}】${$.nickName || $.UserName}****\n`);
        if (!$.isLogin) {
          $.msg($.name, `【提示】cookie已失效`, `京东账号${$.index} ${$.nickName || $.UserName}\n请重新登录获取\nhttps://bean.m.jd.com/bean/signIndex.action`, {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});
  
          // if ($.isNode()) {
          //   await notify.sendNotify(`${$.name}cookie已失效 - ${$.UserName}`, `京东账号${$.index} ${$.UserName}\n请重新登录获取cookie`);
          // }
          continue
        }
        // console.log(`本地时间与京东服务器时间差(毫秒)：${await get_diff_time()}`);
        await joyReward();
      }
    }
    if ($.isNode() && allMessage && $.ctrTemp) {
      await notify.sendNotify(`${$.name}`, `${allMessage}`)
    }
  })()
      .catch((e) => {
        $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
      })
      .finally(() => {
        $.done();
      })
  
  
  async function joyReward() {
    try {
      await getExchangeRewards();
      if ($.getExchangeRewardsRes && $.getExchangeRewardsRes.success) {
        // console.log('success', $.getExchangeRewardsRes);
        const data = $.getExchangeRewardsRes.data;
        // const levelSaleInfos = data.levelSaleInfos;
        // const giftSaleInfos = levelSaleInfos.giftSaleInfos;
        // console.log(`当前积分 ${data.coin}\n`);
        // console.log(`宠物等级 ${data.level}\n`);
        let saleInfoId = '', giftValue = '', extInfo = '', leftStock = 0, salePrice = 0;
        let rewardNum = 0;
        if ($.isNode() && process.env.JD_JOY_REWARD_NAME) {
          rewardNum = process.env.JD_JOY_REWARD_NAME * 1;
        } else if ($.getdata('joyRewardName')) {
          if ($.getdata('joyRewardName') * 1 === 1) {
            //兼容之前的BoxJs设置
            rewardNum = 20;
          } else {
            rewardNum = $.getdata('joyRewardName') * 1;
          }
        } else {
          rewardNum = joyRewardName;
        }
        let giftSaleInfos = 'beanConfigs0';
        let time = new Date($.getExchangeRewardsRes['currentTime']).getHours();
        if (time >= 0 && time < 8) {
          giftSaleInfos = 'beanConfigs0';
        }
        if (time >= 8 && time < 16) {
          giftSaleInfos = 'beanConfigs8';
        }
        if (time >= 16 && time < 24) {
          giftSaleInfos = 'beanConfigs16';
        }
        console.log(`\ndebug场次:${giftSaleInfos}\n`)
        for (let item of data[giftSaleInfos]) {
          console.log(`${item['giftName']}当前库存:${item['leftStock']}`)
          if (item.giftType === 'jd_bean' && item['giftValue'] === rewardNum) {
            saleInfoId = item.id;
            leftStock = item.leftStock;
            salePrice = item.salePrice;
            giftValue = item.giftValue;
          }
        }
        // console.log(`${giftValue}京豆当前京豆库存:${leftStock}`)
        // console.log(`saleInfoId:${saleInfoId}`)
        // 兼容之前BoxJs兑换设置的数据
        if (rewardNum && (rewardNum === 1 || rewardNum === 20 || rewardNum === 50 || rewardNum === 100 || rewardNum === 500 || rewardNum === 1000)) {
          //开始兑换
          if (salePrice) {
            if (leftStock) {
              if (!saleInfoId) return
              // console.log(`当前账户积分:${data.coin}\n当前京豆库存:${leftStock}\n满足兑换条件,开始为您兑换京豆\n`);
              console.log(`\n您设置的兑换${giftValue}京豆库存充足,开始为您兑换${giftValue}京豆\n`);
              await exchange(saleInfoId, 'pet');
              if ($.exchangeRes && $.exchangeRes.success) {
                if ($.exchangeRes.errorCode === 'buy_success') {
                  // console.log(`兑换${giftValue}成功,【宠物等级】${data.level}\n【消耗积分】${salePrice}个\n【剩余积分】${data.coin - salePrice}个\n`)
                  console.log(`\n兑换${giftValue}成功,【消耗积分】${salePrice}个\n`)
                  if ($.isNode() && process.env.JD_JOY_REWARD_NOTIFY) {
                    $.ctrTemp = `${process.env.JD_JOY_REWARD_NOTIFY}` === 'false';
                  } else if ($.getdata('jdJoyRewardNotify')) {
                    $.ctrTemp = $.getdata('jdJoyRewardNotify') === 'false';
                  } else {
                    $.ctrTemp = `${jdNotify}` === 'false';
                  }
                  if ($.ctrTemp) {
                    $.msg($.name, ``, `【京东账号${$.index}】${$.nickName}\n【${giftValue}京豆】兑换成功\n【积分详情】消耗积分 ${salePrice}`);
                    if ($.isNode()) {
                      allMessage += `【京东账号${$.index}】 ${$.nickName}\n【${giftValue}京豆】兑换成功\n【积分详情】消耗积分 ${salePrice}${$.index !== cookiesArr.length ? '\n\n' : ''}`
                      // await notify.sendNotify(`${$.name} - 账号${$.index} - ${$.nickName}`, `【京东账号${$.index}】 ${$.nickName}\n【${giftValue}京豆】兑换成功\n【宠物等级】${data.level}\n【积分详情】消耗积分 ${salePrice}, 剩余积分 ${data.coin - salePrice}`);
                    }
                  }
                  // if ($.isNode()) {
                  //   await notify.BarkNotify(`${$.name}`, `【京东账号${$.index}】 ${$.nickName}\n【兑换${giftName}】成功\n【宠物等级】${data.level}\n【消耗积分】${salePrice}分\n【当前剩余】${data.coin - salePrice}积分`);
                  // }
                } else if ($.exchangeRes && $.exchangeRes.errorCode === 'buy_limit') {
                  console.log(`\n兑换${rewardNum}京豆失败，原因：兑换京豆已达上限，请把机会留给更多的小伙伴~\n`)
                  //$.msg($.name, `兑换${giftName}失败`, `【京东账号${$.index}】${$.nickName}\n兑换京豆已达上限\n请把机会留给更多的小伙伴~\n`)
                } else if ($.exchangeRes && $.exchangeRes.errorCode === 'stock_empty'){
                  console.log(`\n兑换${rewardNum}京豆失败，原因：当前京豆库存为空\n`)
                } else if ($.exchangeRes && $.exchangeRes.errorCode === 'insufficient'){
                  console.log(`\n兑换${rewardNum}京豆失败，原因：当前账号积分不足兑换${giftValue}京豆所需的${salePrice}积分\n`)
                } else {
                  console.log(`\n兑奖失败:${JSON.stringify($.exchangeRes)}`)
                }
              } else {
                console.log(`\n兑换京豆异常:${JSON.stringify($.exchangeRes)}`)
              }
            } else {
              console.log(`\n按您设置的兑换${rewardNum}京豆失败，原因：京豆库存不足，已抢完，请下一场再兑换\n`);
            }
          } else {
            // console.log(`兑换${rewardNum}京豆失败，原因：您目前只有${data.coin}积分，已不足兑换${giftValue}京豆所需的${salePrice}积分\n`)
            //$.msg($.name, `兑换${giftName}失败`, `【京东账号${$.index}】${$.nickName}\n目前只有${data.coin}积分\n已不足兑换${giftName}所需的${salePrice}积分\n`)
          }
        } else {
          console.log('您设置了不兑换京豆,如需兑换京豆，请去BoxJs重新设置或修改第20行代码')
        }
      } else {
        console.log(`${$.name}getExchangeRewards异常,${JSON.stringify($.getExchangeRewardsRes)}`)
      }
    } catch (e) {
      $.logErr(e)
    }
  }
  function getExchangeRewards() {
    let opt = {
      url: "//jdjoy.jd.com/common/gift/getBeanConfigs?reqSource=h5",
      method: "GET",
      data: {},
      credentials: "include",
      header: {"content-type": "application/json"}
    }
    return new Promise((resolve) => {
      const option = {
        url: "https:"+ taroRequest(opt)['url'],
        headers: {
          "Host": "jdjoy.jd.com",
          "Content-Type": "application/json",
          "Cookie": cookie,
          "reqSource": "h5",
          "Connection": "keep-alive",
          "Accept": "*/*",
          "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
          "Referer": "https://jdjoy.jd.com/pet/index",
          "Accept-Language": "zh-cn",
          "Accept-Encoding": "gzip, deflate, br"
        },
      }
      $.get(option, (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            $.getExchangeRewardsRes = {};
            if (safeGet(data)) {
              $.getExchangeRewardsRes = JSON.parse(data);
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve();
        }
      });
    })
  }
  function exchange(saleInfoId, orderSource) {
    let body = {"buyParam":{"orderSource":orderSource,"saleInfoId":saleInfoId},"deviceInfo":{}}
    let opt = {
      "url": "//jdjoy.jd.com/common/gift/new/exchange",
      "data":body,
      "credentials":"include","method":"POST","header":{"content-type":"application/json"}
    }
    return new Promise((resolve) => {
      const option = {
        url: "https:"+ taroRequest(opt)['url'],
        body: `${JSON.stringify(body)}`,
        headers: {
          "Host": "jdjoy.jd.com",
          "Accept": "*/*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "zh-cn",
          "Content-Type": "application/json",
          "Origin": "https://jdjoy.jd.com",
          "reqSource": "h5",
          "Connection": "keep-alive",
          "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
          "Referer": "https://jdjoy.jd.com/pet/index",
          "Content-Length": "10",
          "Cookie": cookie
        },
      }
      $.post(option, (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            console.log(`兑换结果:${data}`);
            $.exchangeRes = {};
            if (safeGet(data)) {
              $.exchangeRes = JSON.parse(data);
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve();
        }
      });
    })
  }
  function TotalBean() {
    return new Promise(async resolve => {
      const options = {
        "url": `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`,
        "headers": {
          "Accept": "application/json,text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "zh-cn",
          "Connection": "keep-alive",
          "Cookie": cookie,
          "Referer": "https://wqs.jd.com/my/jingdou/my.shtml?sceneval=2",
          "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0")
        }
      }
      $.post(options, (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            if (data) {
              data = JSON.parse(data);
              if (data['retcode'] === 13) {
                $.isLogin = false; //cookie过期
                return
              }
              if (data['retcode'] === 0) {
                $.nickName = (data['base'] && data['base'].nickname) || $.UserName;
              } else {
                $.nickName = $.UserName
              }
            } else {
              console.log(`京东服务器返回空数据`)
            }
          }
        } catch (e) {
          $.logErr(e, resp)
        } finally {
          resolve();
        }
      })
    })
  }
  function getJDServerTime() {
    return new Promise(resolve => {
      // console.log(Date.now())
      $.get({url: "https://a.jd.com//ajax/queryServerData.html",headers:{
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/87.0.4280.88"
        }}, async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} 获取京东服务器时间失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            $.jdTime = data['serverTime'];
            // console.log(data['serverTime']);
            // console.log(data['serverTime'] - Date.now())
          }
        } catch (e) {
          $.logErr(e, resp)
        } finally {
          resolve($.jdTime);
        }
      })
    })
  }
  async function get_diff_time() {
    // console.log(`本机时间戳 ${Date.now()}`)
    // console.log(`京东服务器时间戳 ${await getJDServerTime()}`)
    return Date.now() - await getJDServerTime();
  }
  function jsonParse(str) {
    if (typeof str == "string") {
      try {
        return JSON.parse(str);
      } catch (e) {
        console.log(e);
        $.msg($.name, '', '请勿随意在BoxJs输入框修改内容\n建议通过脚本去获取cookie')
        return [];
      }
    }
  }
  function safeGet(data) {
    try {
      if (typeof JSON.parse(data) == "object") {
        return true;
      }
    } catch (e) {
      console.log(e);
      console.log(`京东服务器访问数据为空，请检查自身设备网络情况`);
      return false;
    }
  }
  var _0xodV='jsjiami.com.v6',_0x3589=[_0xodV,'AMO6wrh8','w5FmZQ==','w7oZwrIXLQ==','w50Bw5tGwpd6w5k=','GsOTwqvDn8Kl','w6IAcsOBwpg=','NcOgAVos','EcOFE8OBaA==','w7sew75xwq0=','wpbCvyc=','wpnDsA/CvSTDnUTCrsKxw7fDjsKC','w4/ClMOVwoltX8OmEhg/w6VE','bEh1','fUhcwrk=','w4BzYS57w7QwMmXDjnjCh1lQBDfDu8KiwojCm8OBw59EQsO2wqg4JsOESsKTZGk=','wqDCuXLCisOeahfDtxo=','w7shKMO5wozCg205woXCvFciw4gIw7ttw5nDqcORbcOhwrjCucKtCsONX8K8J04/RA==','wrbCjMOKKMKGTAzCtcKOwqXCl0TDvMOEwrRz','LUwMwp19MxQiw6fDvMKLcg==','w54we8OJwr1Y','w6EDwogjKQ==','TmDDmkwM','wrbDnmVuXw==','aElM','JMOFQcKv','w7d8UBpG','w7oSw4M=','aHzDpiU=','w68dw5LDssOr','w446w7p6wps=','KHvCoWbDpg==','N8OrwqpBwqE=','KkgfdcKb','w7YtQsOLwro=','w5rCg8OZwpxj','w4MedsO+','fsKFwo3DumHDgw==','NEwEwr0=','JkYB','L8OWwr3DksKQ','w7TCucOPwpJb','Z0hGwqM=','JGY5U8KJ','wpbDjsOnw5R/Ni8=','OMOrEcOATg==','w5zCncKgcm0=','W0PDuXgZ','w6JzQQ==','woZsw7w/','w7sMw4bCrMON','BcONEw==','wqVqw5kXw4fCssKa','JkgVQA==','w5HCssKb','wrslFA==','a8KuJsKkXQ==','w41AeBNcJipqwq7ClQ==','w7IrasO3AMOoFcOo','LkkS','OMOeIw==','w4vDscOjbcKJ','wrjDvhLCrHfChw==','CcOtwpvClsOOw59/fA4=','w69sWw==','wrfCiMKfb8OMWkw=','CmXCocKa','w4gvw7c=','w5gaaw==','w5YvWsOwRQ==','wqd3w4lzw6zDm8KsaQ==','JMOMLA==','R8KfwrJt','BcOedMOjLS/CsMKd','wpbCv23Dgg==','wqbCpWg=','w4kMw4fCusKewo0=','w4Q3R8OPwrdawobDh8Kt','wqLDgHxJaA==','McOOCkcZ','w4Q4wqg9Iw==','XGHDt1ok','BBHChsKswp8=','w7TDlcKZ','woHCqnjCn8KcMQ==','MRLCpsKJwpjDjsOhwrs=','YVl7AA==','w4VMcQg=','wqYlAA==','DcOMwpjCssOp','VEZ8wqHCiQ==','w5QBw59F','wqbCqBLDpRA=','PCNQwqMhGsOP','wrlfw7tVw7k=','HMOBCMOGaA==','w6Eqw5XCjcOP','w4k7w6VCwrc=','AMOybMO7Fg==','JsOfZcOGNQ==','w7JWGig3','PCNXwqosMcOMwqk=','w6NtPQ==','w5pGWw9LPTBo','w41iQjVB','w680w5nDsMOg','DlPCsMKlwqc=','w41mfyVmw78=','w4gPw5jCh8Os','McOqNm47','w71ndTBR','woDCucKSXsOd','wr7DsFZT','w40Bw4Rf','w5gawpM=','TkVDwpXCnA==','F8O/wptQwpg=','Fg5AwrAO','OsOcD2rCgw==','worClMK6f8OT','wpTDji7CgAc=','wpDDmMOlw4B+','w4ltehJY','w4hdDTUt','w5smW8OBwq1V','w4wjbcOwIg==','w60+w5XCjcOe','wpnDs8Oiw6Nx','AsOEwrPDvMKy','L3PCrFTDpQ==','w6XClcOYwpF9VcO3TA==','DU0ecsKw','wqLDkjXCsQc=','wrDDiATCvyo=','w7nClcKhVQ==','wr3Cnx3DuiLCjw==','w6fCnsOCwo4=','WUxt','w6Erwq06Gg==','wp8UPsKbEA==','eMKEwr07','w4Awwq8VGg==','wqIqFMKVGMOnCw==','w70NwpMQLQ==','dX7DsFwP','w7YYw4Zqwr8=','wrLDqRHCiAY=','PsOwGcOVSA==','PS9SwoQT','woFlw7cTw5E=','MC5hwoAd','wrEpwrPDiAs=','w7EBRsO0wrI=','w73DnsKUwpDCgXI=','w6fCiMO2wo9H','woZbw7Vpw5w=','w7RAfixQ','e8KOwoDDsWDDj8O0w6c=','VGbDo3E9w6Nmwos=','w5wew5PCsMOP','w4AZacOPw5Q=','A8OUV8O7PiXCuw==','w7jDt8O/aMK+','w5AVwoA=','wqrDlMOlwok=','FMOfRA==','EE7Ds8KtUEY=','w4jDpMOjd8KCBMO7w7XDgQ==','e8KFwrc5wonCncOFFw==','c8Oww4DDl8KnLwDCpA==','wrDDnX9ZVA==','UMKnwozDj1s=','w60Zw5DDrcOvwpjDnQ==','d8KjwoQswo8=','M8O2SMOFEQ==','wr3DsE5EQis=','w74fw5g=','wqVqw5gTw4w=','w7EjwpIFMw==','wqt3L8Ktw4DCrzI=','wrzDg8OEw6Fz','w4FFWy5G','wowcGcKZKQ==','fGhoUjk=','w5ItVg==','H8OxwrE=','w7YlS8OwFw==','wpHCjMKPeMKDHg==','wqbDoV1JST4GwpjCow==','McO+CA==','IMOtIyzDvHzCtQ==','wr7CgsKYeA==','FMOWwoo=','O0YV','FRbClsKOw50=','w4BWOw==','T8Oqw4XCgw==','wrZ2GMK8w4rCiTpn','wr42HA==','w6HCnsOPwpVnVQ==','N8OLCXPChw==','w4sJw7nDjsOI','w68Mw4DCvg==','wpfDhcOiw5ViCw==','EMOvL8OZZg==','wovDj8OPw55wHDtvw7bDqMKF','wrrCnwrDnjnCg1k=','Xll8dms=','wpgNA8K7Jw==','w7xcACsT','em5wdC8=','S8KPwowHwrI=','w6QuQMOrw5g=','w555ejtt','WcOWw7LDv8Ko','w6XDlMK2wpjCgn8ETMK/wpJr','PMOxwrDDjg==','w5kewo02HsKZ','w7bDtMKke8KCAMO9w7fDnQ==','wonCkSvDuCQ=','w6QBbMOqHw==','YG9FRSs=','w7/CiMOBwrdZ','WMO/w5DDnsOkfyDCuQ5CwoFm','U8KFwpDDmHvDiMOjw60Mw7M=','NcORwrJFwoE=','w6fCvsO3wr1jw6vCtAgM','H18aV8K9','H0vCtcKtCBF1JcKL','Bw9YwosM','BsOaccOYKw==','w58QWcOCw6o=','w4DCssOuwqZO','PcOfHHLCgw==','A8OswqLDj8KA','w6c3SsOqFcOv','G8OqwprClsOHw5Y=','wpNVw5kQw5k=','aVVgXDY=','M8ONIlA+','HMOXCXHCsA==','w5Eqw7XDlcO0','w6vDgMOCe8KA','e8KFwo/DvHI=','jsjieAami.comZQUzGZKM.Fqvy6Jt=='];(function(_0x4bd822,_0x2bd6f7,_0xb4bdb3){var _0x1d68f6=function(_0x3e105c,_0xc95be1,_0xcc5f36,_0x1a5687,_0x23c90b){_0xc95be1=_0xc95be1>>0x8,_0x23c90b='po';var _0x5d93df='shift',_0x1f243b='push';if(_0xc95be1<_0x3e105c){while(--_0x3e105c){_0x1a5687=_0x4bd822[_0x5d93df]();if(_0xc95be1===_0x3e105c){_0xc95be1=_0x1a5687;_0xcc5f36=_0x4bd822[_0x23c90b+'p']();}else if(_0xc95be1&&_0xcc5f36['replace'](/[eAZQUzGZKMFqyJt=]/g,'')===_0xc95be1){_0x4bd822[_0x1f243b](_0x1a5687);}}_0x4bd822[_0x1f243b](_0x4bd822[_0x5d93df]());}return 0x771ce;};return _0x1d68f6(++_0x2bd6f7,_0xb4bdb3)>>_0x2bd6f7^_0xb4bdb3;}(_0x3589,0xec,0xec00));var _0x50c1=function(_0x5c10af,_0x1f4691){_0x5c10af=~~'0x'['concat'](_0x5c10af);var _0x5bb874=_0x3589[_0x5c10af];if(_0x50c1['klyzIc']===undefined){(function(){var _0x437fd3=function(){var _0x504885;try{_0x504885=Function('return\x20(function()\x20'+'{}.constructor(\x22return\x20this\x22)(\x20)'+');')();}catch(_0x358292){_0x504885=window;}return _0x504885;};var _0x1f0ec7=_0x437fd3();var _0x1b39dc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x1f0ec7['atob']||(_0x1f0ec7['atob']=function(_0x5f1d5f){var _0x579713=String(_0x5f1d5f)['replace'](/=+$/,'');for(var _0x1bcc49=0x0,_0x28d1f2,_0x31f98e,_0x3a5085=0x0,_0x52f8c8='';_0x31f98e=_0x579713['charAt'](_0x3a5085++);~_0x31f98e&&(_0x28d1f2=_0x1bcc49%0x4?_0x28d1f2*0x40+_0x31f98e:_0x31f98e,_0x1bcc49++%0x4)?_0x52f8c8+=String['fromCharCode'](0xff&_0x28d1f2>>(-0x2*_0x1bcc49&0x6)):0x0){_0x31f98e=_0x1b39dc['indexOf'](_0x31f98e);}return _0x52f8c8;});}());var _0x287809=function(_0x4dca12,_0x1f4691){var _0x172c88=[],_0x12e77f=0x0,_0x5b3a5f,_0x1064fc='',_0x26c85e='';_0x4dca12=atob(_0x4dca12);for(var _0x50b5c4=0x0,_0x4e9f15=_0x4dca12['length'];_0x50b5c4<_0x4e9f15;_0x50b5c4++){_0x26c85e+='%'+('00'+_0x4dca12['charCodeAt'](_0x50b5c4)['toString'](0x10))['slice'](-0x2);}_0x4dca12=decodeURIComponent(_0x26c85e);for(var _0x36a5b1=0x0;_0x36a5b1<0x100;_0x36a5b1++){_0x172c88[_0x36a5b1]=_0x36a5b1;}for(_0x36a5b1=0x0;_0x36a5b1<0x100;_0x36a5b1++){_0x12e77f=(_0x12e77f+_0x172c88[_0x36a5b1]+_0x1f4691['charCodeAt'](_0x36a5b1%_0x1f4691['length']))%0x100;_0x5b3a5f=_0x172c88[_0x36a5b1];_0x172c88[_0x36a5b1]=_0x172c88[_0x12e77f];_0x172c88[_0x12e77f]=_0x5b3a5f;}_0x36a5b1=0x0;_0x12e77f=0x0;for(var _0x3385b7=0x0;_0x3385b7<_0x4dca12['length'];_0x3385b7++){_0x36a5b1=(_0x36a5b1+0x1)%0x100;_0x12e77f=(_0x12e77f+_0x172c88[_0x36a5b1])%0x100;_0x5b3a5f=_0x172c88[_0x36a5b1];_0x172c88[_0x36a5b1]=_0x172c88[_0x12e77f];_0x172c88[_0x12e77f]=_0x5b3a5f;_0x1064fc+=String['fromCharCode'](_0x4dca12['charCodeAt'](_0x3385b7)^_0x172c88[(_0x172c88[_0x36a5b1]+_0x172c88[_0x12e77f])%0x100]);}return _0x1064fc;};_0x50c1['uNopam']=_0x287809;_0x50c1['bBBPYs']={};_0x50c1['klyzIc']=!![];}var _0x2685e3=_0x50c1['bBBPYs'][_0x5c10af];if(_0x2685e3===undefined){if(_0x50c1['MzNDcx']===undefined){_0x50c1['MzNDcx']=!![];}_0x5bb874=_0x50c1['uNopam'](_0x5bb874,_0x1f4691);_0x50c1['bBBPYs'][_0x5c10af]=_0x5bb874;}else{_0x5bb874=_0x2685e3;}return _0x5bb874;};function taroRequest(_0x4562b8){var _0x5e1be5={'Vxbak':function(_0x51c581,_0x5b34fe){return _0x51c581>_0x5b34fe;},'oAHvw':function(_0x301b4d,_0x45142b){return _0x301b4d>=_0x45142b;},'NmxTA':function(_0x4a7449,_0x35b5ad){return _0x4a7449+_0x35b5ad;},'fKyeQ':function(_0x55c935,_0x30de79){return _0x55c935+_0x30de79;},'PxtIu':function(_0x108ffa,_0x1f1c2c){return _0x108ffa===_0x1f1c2c;},'aonPe':_0x50c1('0','7^B*'),'Anwmc':_0x50c1('1','H4)l'),'wRaxF':function(_0x3ed935,_0x1dcb0a){return _0x3ed935>=_0x1dcb0a;},'jGaRg':function(_0x15d225,_0x1bf5cd){return _0x15d225+_0x1bf5cd;},'wUSiO':function(_0x29bc83,_0x377cd0){return _0x29bc83+_0x377cd0;},'plEXL':function(_0x14a436,_0x28dc15){return _0x14a436+_0x28dc15;},'qCKlI':function(_0x14014d,_0x2059f5){return _0x14014d!==_0x2059f5;},'aiwGl':_0x50c1('2','#o@B'),'AlsQu':_0x50c1('3','g8a8'),'WnBQj':_0x50c1('4','M4vD'),'CblXD':function(_0x338b17,_0x582862,_0x5b6da5){return _0x338b17(_0x582862,_0x5b6da5);},'pHyqn':function(_0x450ee2,_0xc9f580){return _0x450ee2 instanceof _0xc9f580;},'iYuZb':function(_0x13f9a2,_0x48a96a){return _0x13f9a2<_0x48a96a;},'zzWYr':function(_0x49fbc5,_0x4e09d8){return _0x49fbc5 instanceof _0x4e09d8;},'STnCh':function(_0x2af259,_0x1ae066){return _0x2af259||_0x1ae066;},'FjoWN':function(_0x588a20,_0x1f80db,_0x2aa526){return _0x588a20(_0x1f80db,_0x2aa526);},'CCtvW':function(_0x13b7c7,_0x39e512){return _0x13b7c7+_0x39e512;},'JgTsP':function(_0x2e2167,_0xd7f440){return _0x2e2167!==_0xd7f440;},'YyFbf':_0x50c1('5','IV09'),'nQOIF':_0x50c1('6','DOsV'),'oxfqy':_0x50c1('7','VKxZ'),'gDria':_0x50c1('8','@ri*'),'meULp':function(_0x476487,_0x10f522){return _0x476487<_0x10f522;},'fSaRv':_0x50c1('9','qs2T'),'XMTxF':function(_0x28b8e2,_0x4dbf6c){return _0x28b8e2+_0x4dbf6c;},'JWevk':function(_0x10ec95,_0x369849){return _0x10ec95>_0x369849;},'uKLDp':function(_0x4c38f4,_0x2d55b6){return _0x4c38f4>=_0x2d55b6;},'HvpAG':function(_0x43debb,_0x19bad6){return _0x43debb+_0x19bad6;},'hbfBJ':_0x50c1('a','qRp%'),'AaMvo':function(_0x206a17,_0x3a909b){return _0x206a17!==_0x3a909b;},'ecUFD':_0x50c1('b','S9Ns'),'FRjlU':_0x50c1('c','k1Z4'),'FBsRk':function(_0x1e4544,_0x26e31f){return _0x1e4544<_0x26e31f;},'ksMrO':function(_0x5e98b1,_0xeebb40){return _0x5e98b1===_0xeebb40;},'UConB':_0x50c1('d','#o@B'),'Wsgog':function(_0x1dcfcb,_0x6beb66){return _0x1dcfcb+_0x6beb66;},'CgnvR':function(_0x8d4df4,_0x737098){return _0x8d4df4+_0x737098;},'FXyGe':function(_0x5d6b80,_0x5cc42c){return _0x5d6b80===_0x5cc42c;},'GXiiI':_0x50c1('e','RHMX'),'wEitF':_0x50c1('f','qRp%'),'GpRjT':function(_0x370b36,_0x5bf5db){return _0x370b36===_0x5bf5db;},'TuYOF':_0x50c1('10','KG3M'),'fiFMi':function(_0x546b34,_0x9e5ce2){return _0x546b34===_0x9e5ce2;},'jtaNJ':_0x50c1('11','BG^f'),'SIsKG':_0x50c1('12','PoTt'),'YdXRN':function(_0x2f4dbf,_0x5b9186){return _0x2f4dbf!==_0x5b9186;},'qCqRP':_0x50c1('13','H4)l'),'LUOfF':_0x50c1('14','AgDC'),'CHQDz':_0x50c1('15','@ri*'),'XkXer':function(_0x269598,_0xd9b438){return _0x269598+_0xd9b438;},'bEUim':function(_0xa590e0,_0x5cad53){return _0xa590e0+_0x5cad53;},'kBDcT':function(_0x2dbc4d,_0x55e0b3){return _0x2dbc4d+_0x55e0b3;},'RBlMU':function(_0x5c5b2b,_0x113737){return _0x5c5b2b+_0x113737;},'TxkrC':function(_0x485ada,_0x50d1ab){return _0x485ada(_0x50d1ab);},'wkVOt':function(_0x7acc49,_0x5200f1){return _0x7acc49+_0x5200f1;},'MdGkP':function(_0x55e747,_0x24d20c,_0x597f8f){return _0x55e747(_0x24d20c,_0x597f8f);},'shZQD':_0x50c1('16','X[A!'),'cKJNx':_0x50c1('17','US(#'),'pTLQc':_0x50c1('18','UeQW'),'enbvr':function(_0x5a112c,_0x35db75){return _0x5a112c+_0x35db75;},'DXqTY':function(_0x1937b1,_0x21aed3){return _0x1937b1>_0x21aed3;},'CcGPt':_0x50c1('19','9qQF')};const _0x3e9406=$[_0x50c1('1a','k1Z4')]()?_0x5e1be5[_0x50c1('1b','qs2T')](require,_0x5e1be5[_0x50c1('1c','@1x0')]):CryptoJS;const _0x436006=_0x5e1be5[_0x50c1('1d','cmpJ')];const _0x248dc4=_0x3e9406[_0x50c1('1e','AgDC')][_0x50c1('1f','#s[4')][_0x50c1('20','*ii4')](_0x436006);const _0x12d918=_0x3e9406[_0x50c1('21','M4vD')][_0x50c1('22','@1x0')][_0x50c1('23','M4vD')](_0x5e1be5[_0x50c1('24','qRp%')]);let _0x522a40={'AesEncrypt':function AesEncrypt(_0x4562b8){var _0x24b556={'xBtoS':function(_0x33894c,_0x228f9a){return _0x5e1be5[_0x50c1('25','Ehp*')](_0x33894c,_0x228f9a);}};if(_0x5e1be5[_0x50c1('26','VKxZ')](_0x5e1be5[_0x50c1('27','48&e')],_0x5e1be5[_0x50c1('28','k1Z4')])){if(_0x4083de&&_0x5e1be5[_0x50c1('29','PoTt')](Object[_0x50c1('2a','KMz@')](_0x4083de)[_0x50c1('2b','DOsV')],0x0)){var _0x45d7e2=Object[_0x50c1('2c','9qQF')](_0x4083de)[_0x50c1('2d','48&e')](function(_0x3fb059){return _0x24b556[_0x50c1('2e','S9Ns')](_0x24b556[_0x50c1('2f','PoTt')](_0x3fb059,'='),_0x4083de[_0x3fb059]);})[_0x50c1('30','AgDC')]('&');return _0x5e1be5[_0x50c1('31','48&e')](_0x4562b8[_0x50c1('32','s)LE')]('?'),0x0)?_0x5e1be5[_0x50c1('33','RHMX')](_0x5e1be5[_0x50c1('34','cPY%')](_0x4562b8,'&'),_0x45d7e2):_0x5e1be5[_0x50c1('35','@1x0')](_0x5e1be5[_0x50c1('25','Ehp*')](_0x4562b8,'?'),_0x45d7e2);}return _0x4562b8;}else{var _0x4083de=_0x3e9406[_0x50c1('36','*ii4')][_0x50c1('37','p0^z')][_0x50c1('38','c)40')](_0x4562b8);return _0x3e9406[_0x50c1('39','FK(4')][_0x50c1('3a','7^B*')](_0x4083de,_0x248dc4,{'iv':_0x12d918,'mode':_0x3e9406[_0x50c1('3b','48&e')][_0x50c1('3c','cPY%')],'padding':_0x3e9406[_0x50c1('3d','@eMl')][_0x50c1('3e','SKUI')]})[_0x50c1('3f','kV1]')][_0x50c1('40','[Wu3')]();}},'AesDecrypt':function AesDecrypt(_0x4562b8){var _0x4c8a29=_0x3e9406[_0x50c1('41','48&e')][_0x50c1('42','g8a8')][_0x50c1('43','IV09')](_0x4562b8),_0x39b3d1=_0x3e9406[_0x50c1('41','48&e')][_0x50c1('44','BG^f')][_0x50c1('45','N!n4')](_0x4c8a29);return _0x3e9406[_0x50c1('46','kV1]')][_0x50c1('47','UeQW')](_0x39b3d1,_0x248dc4,{'iv':_0x12d918,'mode':_0x3e9406[_0x50c1('48','f3Wj')][_0x50c1('49','c)40')],'padding':_0x3e9406[_0x50c1('4a','KMz@')][_0x50c1('4b','[Wu3')]})[_0x50c1('4c','p0^z')](_0x3e9406[_0x50c1('4d','#o@B')][_0x50c1('4e','188E')])[_0x50c1('4f','#s[4')]();},'Base64Encode':function Base64Encode(_0x4562b8){var _0x2b69a4=_0x3e9406[_0x50c1('4d','#o@B')][_0x50c1('50','X[A!')][_0x50c1('43','IV09')](_0x4562b8);return _0x3e9406[_0x50c1('51','X[A!')][_0x50c1('52','c)40')][_0x50c1('53','k1Z4')](_0x2b69a4);},'Base64Decode':function Base64Decode(_0x4562b8){var _0x3d3752={'wUqMI':function(_0x54b178,_0x2e78d2){return _0x5e1be5[_0x50c1('54','cmpJ')](_0x54b178,_0x2e78d2);},'YaSlQ':function(_0x18154a,_0x33bc95){return _0x5e1be5[_0x50c1('55','#o@B')](_0x18154a,_0x33bc95);}};if(_0x5e1be5[_0x50c1('56','qs2T')](_0x5e1be5[_0x50c1('57','@1x0')],_0x5e1be5[_0x50c1('58','YCIf')])){return _0x3e9406[_0x50c1('59','yi#6')][_0x50c1('5a','X[A!')][_0x50c1('38','c)40')](_0x4562b8)[_0x50c1('5b','YCIf')](_0x3e9406[_0x50c1('41','48&e')][_0x50c1('5c','DPss')]);}else{var _0x5e6274=Object[_0x50c1('5d','kV1]')](_0x15bedb)[_0x50c1('5e','@eMl')](function(_0x405686){return _0x3d3752[_0x50c1('5f','N!n4')](_0x3d3752[_0x50c1('60','AgDC')](_0x405686,'='),_0x15bedb[_0x405686]);})[_0x50c1('61','qRp%')]('&');return _0x5e1be5[_0x50c1('62','KG3M')](_0x4562b8[_0x50c1('63','QIy0')]('?'),0x0)?_0x5e1be5[_0x50c1('64','p0^z')](_0x5e1be5[_0x50c1('65','RHMX')](_0x4562b8,'&'),_0x5e6274):_0x5e1be5[_0x50c1('66','c)40')](_0x5e1be5[_0x50c1('67','qRp%')](_0x4562b8,'?'),_0x5e6274);}},'Md5encode':function Md5encode(_0x4562b8){if(_0x5e1be5[_0x50c1('68','#s[4')](_0x5e1be5[_0x50c1('69','#s[4')],_0x5e1be5[_0x50c1('6a','CJw1')])){var _0x46e363=_0x15bedb[_0x3e9406];_0x4562b8[_0x50c1('6b','QIy0')](_0x46e363)&&!_0x52c084&&(_0x52c084=!0x0);}else{return _0x3e9406[_0x50c1('6c','kV1]')](_0x4562b8)[_0x50c1('6d','kV1]')]();}},'keyCode':_0x5e1be5[_0x50c1('6e','kV1]')]};const _0x10c259=function sortByLetter(_0x4562b8,_0x505fb9){if(_0x5e1be5[_0x50c1('6f','M4vD')](_0x4562b8,Array)){_0x505fb9=_0x505fb9||[];for(var _0x3d9086=0x0;_0x5e1be5[_0x50c1('70','f3Wj')](_0x3d9086,_0x4562b8[_0x50c1('71','@ri*')]);_0x3d9086++)_0x505fb9[_0x3d9086]=_0x5e1be5[_0x50c1('72','c)40')](sortByLetter,_0x4562b8[_0x3d9086],_0x505fb9[_0x3d9086]);}else!_0x5e1be5[_0x50c1('73','#o@B')](_0x4562b8,Array)&&_0x5e1be5[_0x50c1('74','*ii4')](_0x4562b8,Object)?(_0x505fb9=_0x5e1be5[_0x50c1('75','UeQW')](_0x505fb9,{}),Object[_0x50c1('76','cmpJ')](_0x4562b8)[_0x50c1('77','qRp%')]()[_0x50c1('78','qs2T')](function(_0x3d9086){_0x505fb9[_0x3d9086]=_0x5e1be5[_0x50c1('79','AgDC')](sortByLetter,_0x4562b8[_0x3d9086],_0x505fb9[_0x3d9086]);})):_0x505fb9=_0x4562b8;return _0x505fb9;};const _0x29a333=function isInWhiteAPI(_0x4562b8){var _0x3931ba={'UPzAq':function(_0x132f63,_0x15ffa6){return _0x5e1be5[_0x50c1('7a','VKxZ')](_0x132f63,_0x15ffa6);},'aCtWR':function(_0x1b9ea2,_0x418561){return _0x5e1be5[_0x50c1('7b','QIy0')](_0x1b9ea2,_0x418561);}};if(_0x5e1be5[_0x50c1('7c','g8a8')](_0x5e1be5[_0x50c1('7d','UeQW')],_0x5e1be5[_0x50c1('7e','BG^f')])){for(var _0x459be0=[_0x5e1be5[_0x50c1('7f','s)LE')],_0x5e1be5[_0x50c1('80','kV1]')]],_0x218261=!0x1,_0x3e9406=0x0;_0x5e1be5[_0x50c1('81','CJw1')](_0x3e9406,_0x459be0[_0x50c1('82','k1Z4')]);_0x3e9406++){if(_0x5e1be5[_0x50c1('83','[Wu3')](_0x5e1be5[_0x50c1('84','c)40')],_0x5e1be5[_0x50c1('85','s)LE')])){return _0x3931ba[_0x50c1('86','S9Ns')](_0x3931ba[_0x50c1('87','Ehp*')](_0x4562b8,'='),_0x459be0[_0x4562b8]);}else{var _0x436006=_0x459be0[_0x3e9406];_0x4562b8[_0x50c1('88','PoTt')](_0x436006)&&!_0x218261&&(_0x218261=!0x0);}}return _0x218261;}else{_0x459be0[_0x218261]=_0x5e1be5[_0x50c1('89','48&e')](sortByLetter,_0x4562b8[_0x218261],_0x459be0[_0x218261]);}};const _0x2a2c3c=function addQueryToPath(_0x4562b8,_0xf37fc9){var _0x39723c={'TPNkp':function(_0x722ea9,_0x350bb3){return _0x5e1be5[_0x50c1('8a','BG^f')](_0x722ea9,_0x350bb3);}};if(_0xf37fc9&&_0x5e1be5[_0x50c1('8b','BG^f')](Object[_0x50c1('8c','cPY%')](_0xf37fc9)[_0x50c1('8d','KG3M')],0x0)){var _0x47e0e3=Object[_0x50c1('8e','PoTt')](_0xf37fc9)[_0x50c1('8f','DPss')](function(_0x4562b8){return _0x39723c[_0x50c1('90','qs2T')](_0x39723c[_0x50c1('91','@eMl')](_0x4562b8,'='),_0xf37fc9[_0x4562b8]);})[_0x50c1('92','188E')]('&');return _0x5e1be5[_0x50c1('93','qs2T')](_0x4562b8[_0x50c1('94','@eMl')]('?'),0x0)?_0x5e1be5[_0x50c1('95','qs2T')](_0x5e1be5[_0x50c1('96','@1x0')](_0x4562b8,'&'),_0x47e0e3):_0x5e1be5[_0x50c1('97','qRp%')](_0x5e1be5[_0x50c1('98','BG^f')](_0x4562b8,'?'),_0x47e0e3);}return _0x4562b8;};const _0x40f690=function apiConvert(_0x4562b8){var _0xd2baca={'eHPys':function(_0x5982a8,_0x2e7446){return _0x5e1be5[_0x50c1('99','RHMX')](_0x5982a8,_0x2e7446);},'BGoRN':_0x5e1be5[_0x50c1('9a','QIy0')]};if(_0x5e1be5[_0x50c1('9b','7^B*')](_0x5e1be5[_0x50c1('9c','QIy0')],_0x5e1be5[_0x50c1('9d','7vaA')])){for(var _0x5ed4be=_0x12d918,_0x4e947a=0x0;_0x5e1be5[_0x50c1('9e','k1Z4')](_0x4e947a,_0x5ed4be[_0x50c1('9f','yi#6')]);_0x4e947a++){if(_0x5e1be5[_0x50c1('a0','PoTt')](_0x5e1be5[_0x50c1('a1','p0^z')],_0x5e1be5[_0x50c1('a2','@ri*')])){var _0x3e9406=_0x5ed4be[_0x4e947a];_0x4562b8[_0x50c1('a3','DOsV')](_0x3e9406)&&!_0x4562b8[_0x50c1('a4','@1x0')](_0x5e1be5[_0x50c1('a5','c)40')](_0x5e1be5[_0x50c1('a6','KMz@')],_0x3e9406))&&(_0x4562b8=_0x4562b8[_0x50c1('a7','#s[4')](_0x3e9406,_0x5e1be5[_0x50c1('a8','IV09')](_0x5e1be5[_0x50c1('9a','QIy0')],_0x3e9406)));}else{var _0x4f6d0b=_0x3e9406[_0x50c1('a9','qs2T')][_0x50c1('aa','s)LE')][_0x50c1('38','c)40')](_0x4562b8);return _0x3e9406[_0x50c1('ab','#s[4')][_0x50c1('ac','tFYr')][_0x50c1('ad','IV09')](_0x4f6d0b);}}return _0x4562b8;}else{var _0x3fa031=_0x5ed4be[_0x4e947a];_0x4562b8[_0x50c1('ae','188E')](_0x3fa031)&&!_0x4562b8[_0x50c1('af','^XlU')](_0xd2baca[_0x50c1('b0','cmpJ')](_0xd2baca[_0x50c1('b1','DOsV')],_0x3fa031))&&(_0x4562b8=_0x4562b8[_0x50c1('b2','M4vD')](_0x3fa031,_0xd2baca[_0x50c1('b3','188E')](_0xd2baca[_0x50c1('b4','#s[4')],_0x3fa031)));}};var _0x15bedb=_0x4562b8,_0x52c084=(_0x15bedb[_0x50c1('b5','cmpJ')],_0x15bedb[_0x50c1('b6','c)40')]);_0x52c084+=_0x5e1be5[_0x50c1('b7','7^B*')](_0x5e1be5[_0x50c1('b8','qs2T')](_0x52c084[_0x50c1('b9','US(#')]('?'),-0x1)?'&':'?',_0x5e1be5[_0x50c1('ba','s)LE')]);var _0x37f351=function getTimeSign(_0x4562b8){if(_0x5e1be5[_0x50c1('bb','*ii4')](_0x5e1be5[_0x50c1('bc','@eMl')],_0x5e1be5[_0x50c1('bd','H4)l')])){var _0x1f5dc7=_0x3e9406[_0x50c1('be','k1Z4')][_0x50c1('bf','S9Ns')][_0x50c1('c0','[Wu3')](_0x4562b8),_0x5cdf16=_0x3e9406[_0x50c1('21','M4vD')][_0x50c1('c1','UeQW')][_0x50c1('c2','cmpJ')](_0x1f5dc7);return _0x3e9406[_0x50c1('c3','g8a8')][_0x50c1('c4','FK(4')](_0x5cdf16,_0x248dc4,{'iv':_0x12d918,'mode':_0x3e9406[_0x50c1('c5','UeQW')][_0x50c1('c6','S9Ns')],'padding':_0x3e9406[_0x50c1('c7','48&e')][_0x50c1('c8','YCIf')]})[_0x50c1('6d','kV1]')](_0x3e9406[_0x50c1('c9','CJw1')][_0x50c1('ca','^XlU')])[_0x50c1('cb','US(#')]();}else{var _0x15bedb=_0x4562b8[_0x50c1('cc','@eMl')],_0x52c084=_0x4562b8[_0x50c1('cd','PoTt')],_0x3e9406=_0x5e1be5[_0x50c1('ce','g8a8')](void 0x0,_0x52c084)?_0x5e1be5[_0x50c1('cf','M4vD')]:_0x52c084,_0x436006=_0x4562b8[_0x50c1('d0','c)40')],_0x12d918=_0x4562b8[_0x50c1('d1','s)LE')],_0x49e71f=_0x5e1be5[_0x50c1('d2','RHMX')](void 0x0,_0x12d918)?{}:_0x12d918,_0x40c97f=_0x3e9406[_0x50c1('d3','s)LE')](),_0x41cd7a=_0x522a40[_0x50c1('d4','KG3M')],_0x4cc6fb=_0x49e71f[_0x5e1be5[_0x50c1('d5','DPss')]]||_0x49e71f[_0x5e1be5[_0x50c1('d6','@eMl')]]||'',_0x43d27f='',_0x341f8b=+new Date();return _0x43d27f=_0x5e1be5[_0x50c1('d7','CJw1')](_0x5e1be5[_0x50c1('d8','H4)l')],_0x40c97f)&&(_0x5e1be5[_0x50c1('d9','188E')](_0x5e1be5[_0x50c1('da','KMz@')],_0x40c97f)||_0x5e1be5[_0x50c1('db','*ii4')](_0x5e1be5[_0x50c1('dc','^XlU')],_0x4cc6fb[_0x50c1('dd','yi#6')]())&&_0x436006&&Object[_0x50c1('de','S9Ns')](_0x436006)[_0x50c1('df','qs2T')])?_0x522a40[_0x50c1('e0','IV09')](_0x5e1be5[_0x50c1('e1','KG3M')](_0x5e1be5[_0x50c1('e2','[Wu3')](_0x5e1be5[_0x50c1('e3','H4)l')](_0x5e1be5[_0x50c1('e4','wxfN')](_0x522a40[_0x50c1('e5','^XlU')](_0x522a40[_0x50c1('e6','DOsV')](_0x5e1be5[_0x50c1('e7','VKxZ')]('',JSON[_0x50c1('e8','wxfN')](_0x5e1be5[_0x50c1('e9','48&e')](_0x10c259,_0x436006))))),'_'),_0x41cd7a),'_'),_0x341f8b)):_0x522a40[_0x50c1('ea','tFYr')](_0x5e1be5[_0x50c1('eb','QIy0')](_0x5e1be5[_0x50c1('ec','#s[4')](_0x5e1be5[_0x50c1('ed','KMz@')]('_',_0x41cd7a),'_'),_0x341f8b)),_0x5e1be5[_0x50c1('ee','wxfN')](_0x29a333,_0x15bedb)&&(_0x15bedb=_0x5e1be5[_0x50c1('ef','g8a8')](_0x2a2c3c,_0x15bedb,{'lks':_0x43d27f,'lkt':_0x341f8b}),_0x15bedb=_0x5e1be5[_0x50c1('f0','S9Ns')](_0x40f690,_0x15bedb)),Object[_0x50c1('f1','[Wu3')](_0x4562b8,{'url':_0x15bedb});}}(_0x4562b8=Object[_0x50c1('f2','N!n4')](_0x4562b8,{'url':_0x52c084}));return _0x37f351;};_0xodV='jsjiami.com.v6';
  // prettier-ignore
  function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}