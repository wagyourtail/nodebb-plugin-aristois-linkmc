const routeHelpers = require.main.require('./src/routes/helpers')
const User = require.main.require('./src/user');
const Group = require.main.require('./src/groups');
const Notification = require.main.require('./src/notifications')
const DB = require.main.require('./src/database');
const fetch = require("node-fetch");
const mcoauth = {};

mcoauth.onAccountEdit = (data, callback) => {
    DB.get(`user:${data.templateData.uid}:linkmc:username`).then((username) => {
        if (username) {
            data.templateData.editButtons.push({
                link: `/user/${data.templateData.userslug}/edit/unlinkmc`,
                text: `Un-Link Minecraft Account ${username}`
            });
        } else {
            data.templateData.editButtons.push({
                link: `/user/${data.templateData.userslug}/edit/linkmc`,
                text: "Link Minecraft Account"
            });
        }

        callback(null, data);
    });
}

async function getUserSlugFromId(uid) {
    return (await User.getUsersWithFields([uid], ['userslug']))[0].userslug
}

async function checkDonor(uid) {
    let uuid = await DB.get(`user:${uid}:linkmc:uuid`);
    if (uuid) {
        // API expects dashed uuid
        uuid = uuid.replace(/([A-z0-9]{8})([A-z0-9]{4})([A-z0-9]{4})([A-z0-9]{4})([A-z0-9]{12})/gmi, "$1-$2-$3-$4-$5");
        const bearer = await DB.get("linkmc:apikey");
        const res = await fetch(`https://api.aristois.net/v3/user/${uuid}`, {
            headers: {
                Authorization: `Bearer ${bearer}`
            }
        });
        if (res.status === 200) {
            const member = Group.isMember(uid, await DB.get("linkmc:donor"));
            const info = await res.json();
            if (info.properties) {
                if (info.properties.donor) {
                    if (!member) {
                        Group.join(await DB.get("linkmc:donor"), uid);
                        Notification.push(await Notification.create({
                            bodyShort: `You have ranked up to donor`,
                            nid: `donor_rankup:${uid}`,
                            datetime: Date.now()
                        }), uid);
                    }
                } else if (member) {
                    Group.leave(await DB.get("linkmc:donor"), uid);
                }
            } else {
                console.error("User not in Aristois database");
            }
        } else {
            console.error(`got error code ${res.status} from donor api: ${res.statusText}`)
        }
    }
}

mcoauth.onLoad = (data, callback) => {
    routeHelpers.setupPageRoute(data.router, "/user/:userslug/edit/linkmc", data.middleware, [], async (req, res, next) => {
        if (await getUserSlugFromId(req.uid) === req.params.userslug) {
            res.render("linkmc", {});
        } else {
            if (!(await User.isAdminOrGlobalMod(req.uid))) {
                res.render("failcallback", {data:"Access Denied", goBack: "../"});
            } else {
                res.render("linkmcadmin", {});
            }
        }
    })

    routeHelpers.setupPageRoute(data.router, "/user/:userslug/edit/linkmc/callback", data.middleware, [], async (req, res, next) => {
        if (await getUserSlugFromId(req.uid) !== req.params.userslug) {
            if (!(await User.isAdminOrGlobalMod(req.uid))) {
                res.render("failcallback", {data:"Access Denied", goBack: "../../"});
            } else {
                if (!req.query.username) {
                    res.render("failcallback", {data: "Failed to parse username", goBack: "../../edit"});
                } else {
                    let result = await fetch(`https://api.mojang.com/users/profiles/minecraft/${req.query.username}`);
                    if (result.status === 200) {
                        const uuid = (await result.json()).id;
                        const uid = await User.getUidByUserslug(req.params.userslug);
                        if (uid) {
                            const prevUid = await DB.get(`linkmc:uuid:${uuid}:uid`);
                            if (prevUid) {
                                const userslug = await getUserSlugFromId(prevUid);
                                res.render("failcallback", {data: `user account is already linked to <a href="../../../${userslug}">${userslug}</a>, un-link it there first.`, goBack: "../../edit"});
                            } else {
                                DB.set(`user:${uid}:linkmc:uuid`, uuid).then(() => checkDonor(uid));
                                DB.set(`user:${uid}:linkmc:username`, req.query.username);
                                DB.set(`linkmc:uuid:${uuid}:uid`, uid);
                                res.render("admincallback", {data: req.query.username, userslug: req.params.userslug});
                            }
                        } else {
                            res.render("failcallback", {data: `Failed to find user ${req.params.userslug}`, goBack: "../../edit"});
                        }
                    } else {
                        res.render("failcallback", {data: `Failed to find uuid for username ${req.query.username}`, goBack: "../../edit"});
                    }
                }
            }
        } else if (!req.query.oauth) {
            res.render("failcallback", {data: "Failed to parse token", goBack: "../../edit"});
        } else {
            try {
                let result = await (await fetch("https://mc-oauth.net/api/api?token", {headers: {token: req.query.oauth}})).json();
                if (result.status !== 'success') result = null;
                if (req.uid && result) {
                    const registeredUID = await DB.get(`linkmc:uuid:${result.uuid}:uid`);
                    const accountUUID = await DB.get(`user:${req.uid}:linkmc:uuid`);
                    if (registeredUID && registeredUID !== req.uid) {
                        if ((await User.bans.isBanned([registeredUID]))) {
                            const slug = (await User.getUsersWithFields([req.uid], ['userslug']))[0].userslug;
                            User.bans.ban(req.uid, 0, `Ban Evasion of ${slug}`);
                            res.render("failcallback", {data: `That minecraft account, ${result.username}, has previously been registered to another user, contact an admin to re-link it.`, goBack: "../../edit"});
                        } else {
                            res.render("failcallback", {data: `That minecraft account, ${result.username}, has previously been registered to another user, contact an admin to re-link it.`, goBack: "../../edit"});
                        }
                    } else if (accountUUID && accountUUID !== result.uuid) {
                        res.render("failcallback", {data: `Your forums account has previously been linked to a different minecraft account, contact an admin to re-link it.`, goBack: "../../edit"});
                    } else {
                        DB.set(`user:${req.uid}:linkmc:uuid`, result.uuid).then(() => checkDonor(req.uid));
                        DB.set(`user:${req.uid}:linkmc:username`, result.username);
                        DB.set(`linkmc:uuid:${result.uuid}:uid`, req.uid);
                        res.render("callback", {data: result.username});
                    }
                } else {
                    res.render("failcallback", {data: "Failed to vertify token", goBack: "../../edit"});
                }
            } catch (e) {
                next(e);
            }
        }
    });

    routeHelpers.setupPageRoute(data.router, "/admin/plugins/linkmc", data.middleware, [], async (req, res, next) => {
        if (User.isAdministrator(req.uid)) {
            res.render("adminpage", {current_key: await DB.get("linkmc:apikey") ?? "", current_donor: await DB.get("linkmc:donor" ?? "")});
        } else {
            res.render("failcallback", {data:"Access Denied", goBack: "../../../"});
        }
    });

    routeHelpers.setupPageRoute(data.router, "/admin/plugins/linkmc/callback", data.middleware, [], async (req, res, next) => {
        if (User.isAdministrator(req.uid)) {
            let groupStatus;
            if (await Group.exists(req.query.donor)) {

                DB.set("linkmc:donor", req.query.donor);
                groupStatus = `${req.query.donor}: OK`;
            } else {
                groupStatus = `${req.query.donor}: FAIL, falling back to "${await DB.get("linkmc:donor")}"`;
            }
            let apiStatus;
            if (req.query.apikey) {
                apiStatus = `${req.query.apikey}: OK`;
                DB.set("linkmc:apikey", req.query.apikey);
            } else {
                apiStatus = `FAIL, falling back to "${await DB.get("linkmc:apikey")}"`
            }
            res.render("adminpagecallback", {apikey: apiStatus, donor: groupStatus});
        } else {
            res.render("failcallback", {data: "Access Denied", goBack: "../../../"});
        }
    });

    routeHelpers.setupPageRoute(data.router, "/user/:userslug/edit/unlinkmc", data.middleware, [], async (req, res, next) => {
        if (await getUserSlugFromId(req.uid) === req.params.userslug) {
            res.render("failcallback", {data: "Contact an admin to un-link/re-link your minecraft account.", goBack: "../edit"});
        } else {
            if (!(await User.isAdminOrGlobalMod(req.uid))) {
                res.render("failcallback", {data:"Access Denied", goBack: "../"});
            } else {
                const uid = await User.getUidByUserslug(req.params.userslug);
                if (uid) {
                    const username = await DB.get(`user:${uid}:linkmc:username`);
                    if (!username) {
                        res.render("failcallback", {data: "Account is not linked to a minecraft account.", goBack: "../edit"});
                    } else {
                        const uuid = await DB.get(`user:${uid}:linkmc:uuid`);
                        DB.delete(`user:${uid}:linkmc:uuid`);
                        DB.delete(`user:${uid}:linkmc:username`);
                        DB.delete(`linkmc:uuid:${uuid}:uid`);
                        res.render("unlinkmc", {data: uuid, userslug: req.params.userslug});
                    }
                } else {
                    res.render("failcallback", {data: `Failed to find user ${req.params.userslug}`, goBack: "../edit"});
                }
            }
        }
    });

    callback();
}

mcoauth.addMenuBtn = async (header) => {
    header.plugins.push({
        route: '/plugins/linkmc',
        icon: 'fa-smile-o',
        name: 'Link MC',
    });
    return header;
}

mcoauth.onLogin = (data, callback) => {
    checkDonor(data.uid);
}

module.exports = mcoauth;