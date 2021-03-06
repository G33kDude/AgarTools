(function(window, $) {
    function onLoad() {
        getServerInfo();
        setInterval(getServerInfo, 18e4);
        mainCanv = mainCanvDup = document.getElementById("canvas");
        mainCtx = mainCanv.getContext("2d");
        mainCanv.onmousedown = function(evt) {
            if (isMobile) {
                var dx = evt.clientX - (5 + winWidth / 5 / 2), dy = evt.clientY - (5 + winWidth / 5 / 2);
                if (Math.sqrt(dx * dx + dy * dy) <= winWidth / 5 / 2) {
                    wsSendCursor();
                    wsSendData(17);
                    return;
                }
            }
            cursorPX = evt.clientX;
            cursorPY = evt.clientY;
            updateCursorCoord();
            wsSendCursor();
        };
        mainCanv.onmousemove = function(evt) {
            cursorPX = evt.clientX;
            cursorPY = evt.clientY;
            updateCursorCoord();
        };
        mainCanv.onmouseup = function(evt) {};
        var keyflag_space = false, keyflag_Q = false, keyflag_W = false;
        window.onkeydown = function(evt) {
            if (32 == evt.keyCode && !keyflag_space) {
                wsSendCursor();
                wsSendData(17);
                keyflag_space = true;
            }
            if (81 == evt.keyCode && !keyflag_Q) {
                wsSendData(18);
                keyflag_Q = true;
            }
            if (87 == evt.keyCode && !keyflag_W) {
                wsSendCursor();
                wsSendData(21);
                keyflag_W = true;
            }
            if (27 == evt.keyCode) $("#overlays").fadeIn(200);
        };
        window.onkeyup = function(evt) {
            if (32 == evt.keyCode) keyflag_space = false;
            if (87 == evt.keyCode) keyflag_W = false;
            if (81 == evt.keyCode && keyflag_Q) {
                wsSendData(19);
                keyflag_Q = false;
            }
        };
        window.onblur = function() {
            wsSendData(19);
            keyflag_W = keyflag_Q = keyflag_space = false;
        };
        window.onresize = onResize;
        onResize();
        if (window.requestAnimationFrame) window.requestAnimationFrame(onAnimationFrame); else setInterval(redraw, 1e3 / 60);
        setInterval(wsSendCursor, 40);
        joinRegion($("#region").val());
        $("#overlays").show();
    }
    function initQuadTree() {
        if (.5 > zoomFactor) quadTree = null; else {
            for (var minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxSize = 0, i = 0; i < cellList.length; i++) if (cellList[i].shouldRender()) {
                maxSize = Math.max(cellList[i].size, maxSize);
                minX = Math.min(cellList[i].x, minX);
                minY = Math.min(cellList[i].y, minY);
                maxX = Math.max(cellList[i].x, maxX);
                maxY = Math.max(cellList[i].y, maxY);
            }
            quadTree = QUAD.init({
                minX: minX - (maxSize + 100),
                minY: minY - (maxSize + 100),
                maxX: maxX + (maxSize + 100),
                maxY: maxY + (maxSize + 100)
            });
            for (i = 0; i < cellList.length; i++) if (minX = cellList[i], minX.shouldRender()) for (minY = 0; minY < minX.points.length; ++minY) quadTree.insert(minX.points[minY]);
        }
    }
    function updateCursorCoord() {
        cursorX = (cursorPX - winWidth / 2) / zoomFactor + viewCenterX;
        cursorY = (cursorPY - winHeight / 2) / zoomFactor + viewCenterY;
    }
    function getServerInfo() {
        if (null == regionName) {
            regionName = {};
            $("#region").children().each(function() {
                var $this = $(this), val = $this.val();
                if (val) regionName[val] = $this.text();
            });
        }
        $.get("http://m.agar.io/info", function(regionData) {
            var regionNumPlayers = {}, region;
            for (region in regionData.regions) {
                var regionSplit = region.split(":")[0];
                regionNumPlayers[regionSplit] = regionNumPlayers[regionSplit] || 0;
                regionNumPlayers[regionSplit] += regionData.regions[region].numPlayers;
            }
            for (region in regionNumPlayers) $('#region option[value="' + region + '"]').text(regionName[region] + " (" + regionNumPlayers[region] + " players)");
        }, "json");
    }
    function hideOverlay() {
        $("#adsBottom").hide();
        $("#overlays").hide();
    }
    function joinRegion(region) {
        if (region && region != currentRegion) {
            currentRegion = region;
            beginConnectServer();
        }
    }
    function tryConnectServer() {
        console.log("Find " + currentRegion + gameMode);
        $.ajax("http://m.agar.io/", {
            error: function() {
                setTimeout(tryConnectServer, 1e3);
            },
            success: function(addr) {
                addr = addr.split("\n");
                openSocket("ws://" + addr[0]);
            },
            dataType: "text",
            method: "POST",
            cache: false,
            crossDomain: true,
            data: currentRegion + gameMode || "?"
        });
    }
    function beginConnectServer() {
        if (currentRegion) {
            $("#connecting").show();
            tryConnectServer();
        }
    }
    function openSocket(socket_addr) {
        if (ws) {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.close();
            ws = null;
        }
        unk_116 = [];
        myBlobs = [];
        cellDict = {};
        cellList = [];
        unk_120 = [];
        leaderboards = [];
        lBoardCanv = unk_146 = null;
        console.log("Connecting to " + socket_addr);
        ws = new WebSocket(socket_addr);
        ws.binaryType = "arraybuffer";
        ws.onopen = wsOnOpen;
        ws.onmessage = wsOnMessage;
        ws.onclose = wsOnClose;
        ws.onerror = function() {
            console.log("socket error");
        };
    }
    function wsOnOpen(msg) {
        $("#connecting").hide();
        console.log("socket open");
        msg = new ArrayBuffer(5);
        var view = new DataView(msg);
        view.setUint8(0, 254);
        view.setUint32(1, 1, true);
        ws.send(msg);
        msg = new ArrayBuffer(5);
        view = new DataView(msg);
        view.setUint8(0, 255);
        view.setUint32(1, 1, true);
        ws.send(msg);
        wsSendNick();
    }
    function wsOnClose(msg) {
        console.log("socket close");
        setTimeout(beginConnectServer, 500);
    }
    function wsOnMessage(msg) {
        function readStr() {
            for (var str = ""; ;) {
                var len = view.getUint16(pos, true);
                pos += 2;
                if (0 == len) break;
                str += String.fromCharCode(len);
            }
            return str;
        }
        var pos = 1, view = new DataView(msg.data);
        switch (view.getUint8(0)) {
          case 16:
            readSocketData(view);
            break;

          case 17:
            newViewCenter_x = view.getFloat32(1, true);
            newViewCenter_y = view.getFloat32(5, true);
            newZoomFactor = view.getFloat32(9, true);
            break;

          case 20:
            myBlobs = [];
            unk_116 = [];
            break;

          case 32:
            unk_116.push(view.getUint32(1, true));
            break;

          case 49:
            if (null != unk_146) break;
            msg = view.getUint32(pos, true);
            pos += 4;
            leaderboards = [];
            for (var i = 0; i < msg; ++i) {
                var id = view.getUint32(pos, true), pos = pos + 4;
                leaderboards.push({
                    id: id,
                    name: readStr()
                });
            }
            redrawLeaderboard();
            break;

          case 50:
            unk_146 = [];
            msg = view.getUint32(pos, true);
            pos += 4;
            for (i = 0; i < msg; ++i) {
                unk_146.push(view.getFloat32(pos, true));
                pos += 4;
            }
            redrawLeaderboard();
            break;

          case 64:
            {
                unk_129 = view.getFloat64(1, true);
                unk_130 = view.getFloat64(9, true);
                unk_131 = view.getFloat64(17, true);
                unk_132 = view.getFloat64(25, true);
                newViewCenter_x = (unk_131 + unk_129) / 2;
                newViewCenter_y = (unk_132 + unk_130) / 2;
                newZoomFactor = 1;
                if (0 == myBlobs.length) {
                    viewCenterX = newViewCenter_x;
                    viewCenterY = newViewCenter_y;
                    zoomFactor = newZoomFactor;
                }
            }
        }
    }
    function readSocketData(view) {
        lastRedrawTime = +new Date();
        var updateCode = Math.random(), pos = 1;
        unk_138 = false;
        for (var unk_55 = view.getUint16(pos, true), pos = pos + 2, unk_56 = 0; unk_56 < unk_55; ++unk_56) {
            var unk_57 = cellDict[view.getUint32(pos, true)], unk_58 = cellDict[view.getUint32(pos + 4, true)], pos = pos + 8;
            if (unk_57 && unk_58) {
                unk_58.destroy();
                unk_58.ox = unk_58.x;
                unk_58.oy = unk_58.y;
                unk_58.oSize = unk_58.size;
                unk_58.nx = unk_57.x;
                unk_58.ny = unk_57.y;
                unk_58.nSize = unk_58.size;
                unk_58.updateTime = lastRedrawTime;
            }
        }
        for (;;) {
            unk_55 = view.getUint32(pos, true);
            pos += 4;
            if (0 == unk_55) break;
            for (var unk_56 = view.getFloat32(pos, true), pos = pos + 4, unk_57 = view.getFloat32(pos, true), pos = pos + 4, unk_58 = view.getFloat32(pos, true), pos = pos + 4, unk_59 = view.getUint8(pos++), unk_60 = view.getUint8(pos++), unk_61 = view.getUint8(pos++), unk_59 = (unk_59 << 16 | unk_60 << 8 | unk_61).toString(16); 6 > unk_59.length; ) unk_59 = "0" + unk_59;
            unk_59 = "#" + unk_59;
            unk_61 = view.getUint8(pos++);
            unk_60 = !!(unk_61 & 1);
            if (unk_61 & 2) pos += 4;
            if (unk_61 & 4) pos += 8;
            if (unk_61 & 8) pos += 16;
            for (unk_61 = ""; ;) {
                var unk_62 = view.getUint16(pos, true), pos = pos + 2;
                if (0 == unk_62) break;
                unk_61 += String.fromCharCode(unk_62);
            }
            unk_62 = null;
            if (cellDict.hasOwnProperty(unk_55)) {
                unk_62 = cellDict[unk_55];
                unk_62.updatePos();
                unk_62.ox = unk_62.x;
                unk_62.oy = unk_62.y;
                unk_62.oSize = unk_62.size;
                unk_62.color = unk_59;
            } else {
                unk_62 = new Cell(unk_55, unk_56, unk_57, unk_58, unk_59, unk_60, unk_61);
                unk_62.pX = unk_56;
                unk_62.pY = unk_57;
            }
            unk_62.nx = unk_56;
            unk_62.ny = unk_57;
            unk_62.nSize = unk_58;
            unk_62.updateCode = updateCode;
            unk_62.updateTime = lastRedrawTime;
            if (-1 != unk_116.indexOf(unk_55) && -1 == myBlobs.indexOf(unk_62)) {
                document.getElementById("overlays").style.display = "none";
                myBlobs.push(unk_62);
                if (1 == myBlobs.length) {
                    viewCenterX = unk_62.x;
                    viewCenterY = unk_62.y;
                }
            }
        }
        view.getUint16(pos, true);
        pos += 2;
        unk_57 = view.getUint32(pos, true);
        pos += 4;
        for (unk_56 = 0; unk_56 < unk_57; unk_56++) {
            unk_55 = view.getUint32(pos, true);
            pos += 4;
            if (cellDict[unk_55]) cellDict[unk_55].updateCode = updateCode;
        }
        for (unk_56 = 0; unk_56 < cellList.length; unk_56++) if (cellList[unk_56].updateCode != updateCode) cellList[unk_56--].destroy();
        if (unk_138 && 0 == myBlobs.length) $("#overlays").fadeIn(3e3);
    }
    function wsSendCursor() {
        if (null != ws && ws.readyState == ws.OPEN) {
            var dx = cursorPX - winWidth / 2, dy = cursorPY - winHeight / 2;
            if (!(64 > dx * dx + dy * dy || prvCursorX == cursorX && prvCursorY == cursorY)) {
                prvCursorX = cursorX;
                prvCursorY = cursorY;
                dx = new ArrayBuffer(21);
                dy = new DataView(dx);
                dy.setUint8(0, 16);
                dy.setFloat64(1, cursorX, true);
                dy.setFloat64(9, cursorY, true);
                dy.setUint32(17, 0, true);
                ws.send(dx);
            }
        }
    }
    function wsSendNick() {
        if (null != ws && ws.readyState == ws.OPEN && null != unk_128) {
            var bufffer = new ArrayBuffer(1 + 2 * unk_128.length), view = new DataView(bufffer);
            view.setUint8(0, 0);
            for (var i = 0; i < unk_128.length; ++i) view.setUint16(1 + 2 * i, unk_128.charCodeAt(i), true);
            ws.send(bufffer);
        }
    }
    function wsSendData(data) {
        if (null != ws && ws.readyState == ws.OPEN) {
            var buffer = new ArrayBuffer(1);
            new DataView(buffer).setUint8(0, data);
            ws.send(buffer);
        }
    }
    function onAnimationFrame() {
        redraw();
        window.requestAnimationFrame(onAnimationFrame);
    }
    function onResize() {
        winWidth = window.innerWidth;
        winHeight = window.innerHeight;
        mainCanvDup.width = mainCanv.width = winWidth;
        mainCanvDup.height = mainCanv.height = winHeight;
        redraw();
    }
    function computeZoomFactor() {
        if (0 != myBlobs.length) {
            for (var newZoom = 0, i = 0; i < myBlobs.length; i++) newZoom += myBlobs[i].size;
            newZoom = Math.pow(Math.min(64 / newZoom, 1), .4) * Math.max(winHeight / 1080, winWidth / 1920);
            zoomFactor = (9 * zoomFactor + newZoom) / 10;
        }
    }
    function redraw() {
        var drawTime = +new Date();
        ++unk_126;
        lastRedrawTime = +new Date();
        if (0 < myBlobs.length) {
            computeZoomFactor();
            for (var unk_80 = 0, unk_81 = 0, unk_82 = 0; unk_82 < myBlobs.length; unk_82++) {
                myBlobs[unk_82].updatePos();
                unk_80 += myBlobs[unk_82].x / myBlobs.length;
                unk_81 += myBlobs[unk_82].y / myBlobs.length;
            }
            newViewCenter_x = unk_80;
            newViewCenter_y = unk_81;
            newZoomFactor = zoomFactor;
            viewCenterX = (viewCenterX + unk_80) / 2;
            viewCenterY = (viewCenterY + unk_81) / 2;
        } else {
            viewCenterX = (29 * viewCenterX + newViewCenter_x) / 30;
            viewCenterY = (29 * viewCenterY + newViewCenter_y) / 30;
            zoomFactor = (9 * zoomFactor + newZoomFactor) / 10;
        }
        initQuadTree();
        updateCursorCoord();
        mainCtx.clearRect(0, 0, winWidth, winHeight);
        mainCtx.fillStyle = darkTheme ? "#111111" : "#F2FBFF";
        mainCtx.fillRect(0, 0, winWidth, winHeight);
        mainCtx.save();
        mainCtx.strokeStyle = darkTheme ? "#AAAAAA" : "#000000";
        mainCtx.globalAlpha = .2;
        mainCtx.scale(zoomFactor, zoomFactor);
        unk_80 = winWidth / zoomFactor;
        unk_81 = winHeight / zoomFactor;
        for (unk_82 = -.5 + (-viewCenterX + unk_80 / 2) % 50; unk_82 < unk_80; unk_82 += 50) {
            mainCtx.beginPath();
            mainCtx.moveTo(unk_82, 0);
            mainCtx.lineTo(unk_82, unk_81);
            mainCtx.stroke();
        }
        for (unk_82 = -.5 + (-viewCenterY + unk_81 / 2) % 50; unk_82 < unk_81; unk_82 += 50) {
            mainCtx.beginPath();
            mainCtx.moveTo(0, unk_82);
            mainCtx.lineTo(unk_80, unk_82);
            mainCtx.stroke();
        }
        mainCtx.restore();
        cellList.sort(function(unk_83, unk_84) {
            return unk_83.size == unk_84.size ? unk_83.id - unk_84.id : unk_83.size - unk_84.size;
        });
        mainCtx.save();
        mainCtx.translate(winWidth / 2, winHeight / 2);
        mainCtx.scale(zoomFactor, zoomFactor);
        mainCtx.translate(-viewCenterX, -viewCenterY);
        for (unk_82 = 0; unk_82 < unk_120.length; unk_82++) unk_120[unk_82].draw();
        for (unk_82 = 0; unk_82 < cellList.length; unk_82++) cellList[unk_82].draw();
        mainCtx.restore();
        if (lBoardCanv) mainCtx.drawImage(lBoardCanv, winWidth - lBoardCanv.width - 10, 10);
        maxScore = Math.max(maxScore, computeScore());
        if (0 != maxScore) {
            if (null == scoreTextDisplayer) scoreTextDisplayer = new TextDisplayer(24, "#FFFFFF");
            scoreTextDisplayer.setValue("Score: " + (0 | maxScore / 100));
            unk_81 = scoreTextDisplayer.render();
            unk_80 = unk_81.width;
            mainCtx.globalAlpha = .2;
            mainCtx.fillStyle = "#000000";
            mainCtx.fillRect(10, winHeight - 10 - 24 - 10, unk_80 + 10, 34);
            mainCtx.globalAlpha = 1;
            mainCtx.drawImage(unk_81, 15, winHeight - 10 - 24 - 5);
        }
        unk_85();
        drawTime = +new Date() - drawTime;
        if (drawTime > 1e3 / 60) numPointFactor -= .01; else if (drawTime < 1e3 / 65) numPointFactor += .01;
        if (.4 > numPointFactor) numPointFactor = .4;
        if (1 < numPointFactor) numPointFactor = 1;
    }
    function unk_85() {
        if (isMobile && unk_149.width) {
            var unk_86 = winWidth / 5;
            mainCtx.drawImage(unk_149, 5, 5, unk_86, unk_86);
        }
    }
    function computeScore() {
        for (var score = 0, i = 0; i < myBlobs.length; i++) score += myBlobs[i].nSize * myBlobs[i].nSize;
        return score;
    }
    function redrawLeaderboard() {
        lBoardCanv = null;
        if (null != unk_146 || 0 != leaderboards.length) if (null != unk_146 || showNames) {
            lBoardCanv = document.createElement("canvas");
            var lBoardCtx = lBoardCanv.getContext("2d"), unk_92 = 60, unk_92 = null == unk_146 ? unk_92 + 24 * leaderboards.length : unk_92 + 180, str = Math.min(200, .3 * winWidth) / 200;
            lBoardCanv.width = 200 * str;
            lBoardCanv.height = unk_92 * str;
            lBoardCtx.scale(str, str);
            lBoardCtx.globalAlpha = .4;
            lBoardCtx.fillStyle = "#000000";
            lBoardCtx.fillRect(0, 0, 200, unk_92);
            lBoardCtx.globalAlpha = 1;
            lBoardCtx.fillStyle = "#FFFFFF";
            str = null;
            str = "Leaderboard";
            lBoardCtx.font = "30px Ubuntu";
            lBoardCtx.fillText(str, 100 - lBoardCtx.measureText(str).width / 2, 40);
            if (null == unk_146) for (lBoardCtx.font = "20px Ubuntu", unk_92 = 0; unk_92 < leaderboards.length; ++unk_92) {
                str = leaderboards[unk_92].name || "An unnamed cell";
                if (!showNames) str = "An unnamed cell";
                if (-1 != unk_116.indexOf(leaderboards[unk_92].id)) {
                    if (myBlobs[0].name) str = myBlobs[0].name;
                    lBoardCtx.fillStyle = "#FFAAAA";
                } else lBoardCtx.fillStyle = "#FFFFFF";
                str = unk_92 + 1 + ". " + str;
                lBoardCtx.fillText(str, 100 - lBoardCtx.measureText(str).width / 2, 70 + 24 * unk_92);
            } else for (unk_92 = str = 0; unk_92 < unk_146.length; ++unk_92) {
                angEnd = str + unk_146[unk_92] * Math.PI * 2;
                lBoardCtx.fillStyle = unk_147[unk_92 + 1];
                lBoardCtx.beginPath();
                lBoardCtx.moveTo(100, 140);
                lBoardCtx.arc(100, 140, 80, str, angEnd, false);
                lBoardCtx.fill();
                str = angEnd;
            }
        }
    }
    function Cell(id, x, y, size, color, isVirus, name) {
        cellList.push(this);
        cellDict[id] = this;
        this.id = id;
        this.ox = this.x = x;
        this.oy = this.y = y;
        this.oSize = this.size = size;
        this.color = color;
        this.isVirus = isVirus;
        this.points = [];
        this.pointsAcc = [];
        this.createPoints();
        this.setName(name);
    }
    function TextDisplayer(size, color, stroke, strokeColor) {
        if (size) this._size = size;
        if (color) this._color = color;
        this._stroke = !!stroke;
        if (strokeColor) this._strokeColor = strokeColor;
    }
    if ("agar.io" != window.location.hostname && "localhost" != window.location.hostname && "10.10.2.13" != window.location.hostname) window.location = "http://agar.io/"; else if (window.top != window) window.top.location = "http://agar.io/"; else {
        var mainCanvDup, mainCtx, mainCanv, winWidth, winHeight, quadTree = null, ws = null, viewCenterX = 0, viewCenterY = 0, unk_116 = [], myBlobs = [], cellDict = {}, cellList = [], unk_120 = [], leaderboards = [], cursorPX = 0, cursorPY = 0, cursorX = -1, cursorY = -1, unk_126 = 0, lastRedrawTime = 0, unk_128 = null, unk_129 = 0, unk_130 = 0, unk_131 = 1e4, unk_132 = 1e4, zoomFactor = 1, currentRegion = null, showSkins = true, showNames = true, noColor = false, unk_138 = false, maxScore = 0, darkTheme = false, showMass = false, newViewCenter_x = viewCenterX = 0 | (unk_129 + unk_131) / 2, newViewCenter_y = viewCenterY = 0 | (unk_130 + unk_132) / 2, newZoomFactor = 1, gameMode = "", unk_146 = null, unk_147 = [ "#333333", "#FF3333", "#33FF33", "#3333FF" ], isMobile = "ontouchstart" in window && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), unk_149 = new Image();
        unk_149.src = "img/split.png";
        var regionName = null;
        window.setNick = function(_nick) {
            hideOverlay();
            unk_128 = _nick;
            wsSendNick();
            maxScore = 0;
        };
        window.setRegion = joinRegion;
        window.setSkins = function(_skin) {
            showSkins = _skin;
        };
        window.setNames = function(_name) {
            showNames = _name;
        };
        window.setDarkTheme = function(_darkTheme) {
            darkTheme = _darkTheme;
        };
        window.setColors = function(_color) {
            noColor = _color;
        };
        window.setShowMass = function(_showMass) {
            showMass = _showMass;
        };
        window.spectate = function() {
            wsSendData(1);
            hideOverlay();
        };
        window.setGameMode = function(_gameMode) {
            if (_gameMode != gameMode) {
                gameMode = _gameMode;
                beginConnectServer();
            }
        };
        window.connect = openSocket;
        var prvCursorX = -1, prvCursorY = -1, lBoardCanv = null, numPointFactor = 1, scoreTextDisplayer = null, skinImages = {}, skinList = "poland;usa;china;russia;canada;australia;spain;brazil;germany;ukraine;france;sweden;hitler;north korea;south korea;japan;united kingdom;earth;greece;latvia;lithuania;estonia;finland;norway;cia;maldivas;austria;nigeria;reddit;yaranaika;confederate;9gag;indiana;4chan;italy;ussr;bulgaria;tumblr;2ch.hk;hong kong;portugal;jamaica;german empire;mexico;sanik;switzerland;croatia;chile;indonesia;bangladesh;thailand;iran;iraq;peru;moon;botswana;bosnia;netherlands;european union;taiwan;pakistan;hungary;satanist;qing dynasty;nazi;matriarchy;patriarchy;feminism;ireland;texas;facepunch;prodota;cambodia;steam;piccolo;ea;india;kc;denmark;quebec;ayy lmao;sealand;bait;tsarist russia;origin;vinesauce;stalin;belgium;luxembourg;stussy;prussia;8ch;argentina;scotland;sir;romania;belarus;wojak;isis;doge;nasa;byzantium;imperial japan;french kingdom;somalia;turkey;mars;pokerface".split(";"), unk_165 = [ "m'blob" ];
        Cell.prototype = {
            id: 0,
            points: null,
            pointsAcc: null,
            name: null,
            nameCache: null,
            sizeCache: null,
            x: 0,
            y: 0,
            size: 0,
            ox: 0,
            oy: 0,
            oSize: 0,
            nx: 0,
            ny: 0,
            nSize: 0,
            updateTime: 0,
            updateCode: 0,
            drawTime: 0,
            destroyed: false,
            isVirus: false,
            destroy: function() {
                var ind;
                for (ind = 0; ind < cellList.length; ind++) if (cellList[ind] == this) {
                    cellList.splice(ind, 1);
                    break;
                }
                delete cellDict[this.id];
                ind = myBlobs.indexOf(this);
                if (-1 != ind) {
                    unk_138 = true;
                    myBlobs.splice(ind, 1);
                }
                ind = unk_116.indexOf(this.id);
                if (-1 != ind) unk_116.splice(ind, 1);
                this.destroyed = true;
                unk_120.push(this);
            },
            getNameSize: function() {
                return Math.max(0 | .3 * this.size, 24);
            },
            setName: function(name) {
                if (this.name = name) {
                    if (null == this.nameCache) this.nameCache = new TextDisplayer(this.getNameSize(), "#FFFFFF", true, "#000000"); else this.nameCache.setSize(this.getNameSize());
                    this.nameCache.setValue(this.name);
                }
            },
            createPoints: function() {
                for (var numPoints = this.getNumPoints(); this.points.length > numPoints; ) {
                    var unk_169 = 0 | Math.random() * this.points.length;
                    this.points.splice(unk_169, 1);
                    this.pointsAcc.splice(unk_169, 1);
                }
                if (0 == this.points.length && 0 < numPoints) {
                    this.points.push({
                        c: this,
                        v: this.size,
                        x: this.x,
                        y: this.y
                    });
                    this.pointsAcc.push(Math.random() - .5);
                }
                for (;this.points.length < numPoints; ) {
                    var unk_169 = 0 | Math.random() * this.points.length, unk_170 = this.points[unk_169];
                    this.points.splice(unk_169, 0, {
                        c: this,
                        v: unk_170.v,
                        x: unk_170.x,
                        y: unk_170.y
                    });
                    this.pointsAcc.splice(unk_169, 0, this.pointsAcc[unk_169]);
                }
            },
            getNumPoints: function() {
                var minPoints = 10;
                if (20 > this.size) minPoints = 5;
                if (this.isVirus) minPoints = 30;
                return 0 | Math.max(this.size * zoomFactor * (this.isVirus ? Math.min(2 * numPointFactor, 1) : numPointFactor), minPoints);
            },
            movePoints: function() {
                this.createPoints();
                for (var points = this.points, orig_pointsAcc = this.pointsAcc, pointsAcc = orig_pointsAcc.concat(), new_points = points.concat(), pointsLen = new_points.length, i = 0; i < pointsLen; ++i) {
                    var unk_178 = pointsAcc[(i - 1 + pointsLen) % pointsLen], unk_179 = pointsAcc[(i + 1) % pointsLen];
                    orig_pointsAcc[i] += Math.random() - .5;
                    orig_pointsAcc[i] *= .7;
                    if (10 < orig_pointsAcc[i]) orig_pointsAcc[i] = 10;
                    if (-10 > orig_pointsAcc[i]) orig_pointsAcc[i] = -10;
                    orig_pointsAcc[i] = (unk_178 + unk_179 + 8 * orig_pointsAcc[i]) / 10;
                }
                for (var self = this, i = 0; i < pointsLen; ++i) {
                    pointsAcc = new_points[i].v;
                    unk_178 = new_points[(i - 1 + pointsLen) % pointsLen].v;
                    unk_179 = new_points[(i + 1) % pointsLen].v;
                    if (15 < this.size && null != quadTree) {
                        var unk_181 = false, unk_182 = points[i].x, unk_183 = points[i].y;
                        quadTree.retrieve2(unk_182 - 5, unk_183 - 5, 10, 10, function(unk_184) {
                            if (unk_184.c != self && 25 > (unk_182 - unk_184.x) * (unk_182 - unk_184.x) + (unk_183 - unk_184.y) * (unk_183 - unk_184.y)) unk_181 = true;
                        });
                        if (!unk_181 && (points[i].x < unk_129 || points[i].y < unk_130 || points[i].x > unk_131 || points[i].y > unk_132)) unk_181 = true;
                        if (unk_181) {
                            if (0 < orig_pointsAcc[i]) orig_pointsAcc[i] = 0;
                            orig_pointsAcc[i] -= 1;
                        }
                    }
                    pointsAcc += orig_pointsAcc[i];
                    if (0 > pointsAcc) pointsAcc = 0;
                    pointsAcc = (12 * pointsAcc + this.size) / 13;
                    points[i].v = (unk_178 + unk_179 + 8 * pointsAcc) / 10;
                    unk_178 = 2 * Math.PI / pointsLen;
                    unk_179 = this.points[i].v;
                    if (this.isVirus && 0 == i % 2) unk_179 += 5;
                    points[i].x = this.x + Math.cos(unk_178 * i) * unk_179;
                    points[i].y = this.y + Math.sin(unk_178 * i) * unk_179;
                }
            },
            updatePos: function() {
                var updateRate;
                updateRate = (lastRedrawTime - this.updateTime) / 120;
                updateRate = 0 > updateRate ? 0 : 1 < updateRate ? 1 : updateRate;
                updateRate = updateRate * updateRate * (3 - 2 * updateRate);
                this.getNameSize();
                if (this.destroyed && 1 <= updateRate) {
                    var unk_186 = unk_120.indexOf(this);
                    if (-1 != unk_186) unk_120.splice(unk_186, 1);
                }
                this.x = updateRate * (this.nx - this.ox) + this.ox;
                this.y = updateRate * (this.ny - this.oy) + this.oy;
                this.size = updateRate * (this.nSize - this.oSize) + this.oSize;
                return updateRate;
            },
            shouldRender: function() {
                return this.x + this.size + 40 < viewCenterX - winWidth / 2 / zoomFactor || this.y + this.size + 40 < viewCenterY - winHeight / 2 / zoomFactor || this.x - this.size - 40 > viewCenterX + winWidth / 2 / zoomFactor || this.y - this.size - 40 > viewCenterY + winHeight / 2 / zoomFactor ? false : true;
            },
            draw: function() {
                if (this.shouldRender()) {
                    var misc1 = !this.isVirus && .5 > zoomFactor;
                    mainCtx.save();
                    this.drawTime = lastRedrawTime;
                    var misc2 = this.updatePos();
                    if (this.destroyed) mainCtx.globalAlpha *= 1 - misc2;
                    mainCtx.lineWidth = 10;
                    mainCtx.lineCap = "round";
                    mainCtx.lineJoin = this.isVirus ? "mitter" : "round";
                    if (noColor) {
                        mainCtx.fillStyle = "#FFFFFF";
                        mainCtx.strokeStyle = "#AAAAAA";
                    } else {
                        mainCtx.fillStyle = this.color;
                        mainCtx.strokeStyle = this.color;
                    }
                    if (misc1) {
                        mainCtx.beginPath();
                        mainCtx.arc(this.x, this.y, this.size, 0, 2 * Math.PI, false);
                    } else {
                        this.movePoints();
                        mainCtx.beginPath();
                        misc2 = this.getNumPoints();
                        mainCtx.moveTo(this.points[0].x, this.points[0].y);
                        for (var misc3 = 1; misc3 <= misc2; ++misc3) {
                            var misc4 = misc3 % misc2;
                            mainCtx.lineTo(this.points[misc4].x, this.points[misc4].y);
                        }
                    }
                    mainCtx.closePath();
                    misc2 = this.name.toLowerCase();
                    if (showSkins && "" == gameMode) if (-1 != skinList.indexOf(misc2)) {
                        if (!skinImages.hasOwnProperty(misc2)) {
                            skinImages[misc2] = new Image();
                            skinImages[misc2].src = "skins/" + misc2 + ".png";
                        }
                        misc3 = skinImages[misc2];
                    } else misc3 = null; else misc3 = null;
                    misc2 = misc3 ? -1 != unk_165.indexOf(misc2) : false;
                    if (!misc1) mainCtx.stroke();
                    mainCtx.fill();
                    if (null != misc3 && 0 < misc3.width && !misc2) {
                        mainCtx.save();
                        mainCtx.clip();
                        mainCtx.drawImage(misc3, this.x - this.size, this.y - this.size, 2 * this.size, 2 * this.size);
                        mainCtx.restore();
                    }
                    if ((noColor || 15 < this.size) && !misc1) {
                        mainCtx.strokeStyle = "#000000";
                        mainCtx.globalAlpha *= .1;
                        mainCtx.stroke();
                    }
                    mainCtx.globalAlpha = 1;
                    if (null != misc3 && 0 < misc3.width && misc2) mainCtx.drawImage(misc3, this.x - 2 * this.size, this.y - 2 * this.size, 4 * this.size, 4 * this.size);
                    misc3 = -1 != myBlobs.indexOf(this);
                    misc1 = 0 | this.y;
                    if ((showNames || misc3) && this.name && this.nameCache) {
                        misc4 = this.nameCache;
                        misc4.setValue(this.name);
                        misc4.setSize(this.getNameSize());
                        misc2 = Math.ceil(10 * zoomFactor) / 10;
                        misc4.setScale(misc2);
                        var misc4 = misc4.render(), textWidth = 0 | misc4.width / misc2, textHeight = 0 | misc4.height / misc2;
                        mainCtx.drawImage(misc4, (0 | this.x) - (0 | textWidth / 2), misc1 - (0 | textHeight / 2), textWidth, textHeight);
                        misc1 += misc4.height / 2 / misc2 + 4;
                    }
                    if (showMass && misc3) {
                        if (null == this.sizeCache) this.sizeCache = new TextDisplayer(this.getNameSize() / 2, "#FFFFFF", true, "#000000");
                        misc3 = this.sizeCache;
                        misc3.setSize(this.getNameSize() / 2);
                        misc3.setValue(0 | this.size * this.size / 100);
                        misc2 = Math.ceil(10 * zoomFactor) / 10;
                        misc3.setScale(misc2);
                        misc4 = misc3.render();
                        textWidth = 0 | misc4.width / misc2;
                        textHeight = 0 | misc4.height / misc2;
                        mainCtx.drawImage(misc4, (0 | this.x) - (0 | textWidth / 2), misc1 - (0 | textHeight / 2), textWidth, textHeight);
                    }
                    mainCtx.restore();
                }
            }
        };
        TextDisplayer.prototype = {
            _value: "",
            _color: "#000000",
            _stroke: false,
            _strokeColor: "#000000",
            _size: 16,
            _canvas: null,
            _ctx: null,
            _dirty: false,
            _scale: 1,
            setSize: function(_size) {
                if (this._size != _size) {
                    this._size = _size;
                    this._dirty = true;
                }
            },
            setScale: function(_scale) {
                if (this._scale != _scale) {
                    this._scale = _scale;
                    this._dirty = true;
                }
            },
            setColor: function(_color) {
                if (this._color != _color) {
                    this._color = _color;
                    this._dirty = true;
                }
            },
            setStroke: function(_stroke) {
                if (this._stroke != _stroke) {
                    this._stroke = _stroke;
                    this._dirty = true;
                }
            },
            setStrokeColor: function(_strokeColor) {
                if (this._strokeColor != _strokeColor) {
                    this._strokeColor = _strokeColor;
                    this._dirty = true;
                }
            },
            setValue: function(_value) {
                if (_value != this._value) {
                    this._value = _value;
                    this._dirty = true;
                }
            },
            render: function() {
                if (null == this._canvas) {
                    this._canvas = document.createElement("canvas");
                    this._ctx = this._canvas.getContext("2d");
                }
                if (this._dirty) {
                    this._dirty = false;
                    var canv = this._canvas, ctx = this._ctx, value = this._value, scale = this._scale, size = this._size, font = size + "px Ubuntu";
                    ctx.font = font;
                    var textWidth = ctx.measureText(value).width, unk_206 = 0 | .2 * size;
                    canv.width = (textWidth + 6) * scale;
                    canv.height = (size + unk_206) * scale;
                    ctx.font = font;
                    ctx.scale(scale, scale);
                    ctx.globalAlpha = 1;
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = this._strokeColor;
                    ctx.fillStyle = this._color;
                    if (this._stroke) ctx.strokeText(value, 3, size - unk_206 / 2);
                    ctx.fillText(value, 3, size - unk_206 / 2);
                }
                return this._canvas;
            }
        };
        window.onload = onLoad;
    }
})(window, jQuery);