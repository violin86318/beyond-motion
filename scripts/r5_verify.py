#!/usr/bin/env python3
"""R5 验证：console 错误、交互、截图（桌面+移动端）"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8790"
OUT = "../scripts/shots-r5"

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- 桌面 ----
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("console", lambda m: errors.append(f"[desktop console.{m.type}] {m.text}") if m.type in ("error",) and "nonexistent" not in (m.location.get("url") or "") else None)
    pg.on("pageerror", lambda e: errors.append(f"[desktop pageerror] {e}"))

    pg.goto(BASE + "/", wait_until="networkidle")
    pg.wait_for_timeout(1800)
    # 移动鼠标触发光标与线条点亮
    pg.mouse.move(700, 450)
    pg.wait_for_timeout(600)
    pg.mouse.move(760, 470)
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/d-hero.png")

    # hero 逐字动画终态：检查所有 char 元素 opacity
    chars = pg.eval_on_selector_all(".char-up, [class*='char']", "els => els.length")
    print("hero char elements:", chars)

    # 滚动触发 reveal
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.5)")
    pg.wait_for_timeout(900)
    pg.screenshot(path=f"{OUT}/d-mid.png")
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(900)
    pg.screenshot(path=f"{OUT}/d-foot.png")

    # works 列表
    pg.goto(BASE + "/works/", wait_until="networkidle")
    pg.wait_for_timeout(900)
    pg.evaluate("window.scrollTo(0, 600)")
    pg.wait_for_timeout(700)
    pg.screenshot(path=f"{OUT}/d-works.png")

    # 详情页 + 「运行作品」交互
    pg.goto(BASE + "/works/dingying-fix/", wait_until="networkidle")
    pg.wait_for_timeout(900)
    pg.screenshot(path=f"{OUT}/d-detail.png")
    btn = pg.query_selector("#run-btn, [id*='run'], a:has-text('运行作品'), button:has-text('运行作品')")
    if btn:
        btn.click()
        pg.wait_for_timeout(2500)
        iframe = pg.query_selector("iframe")
        if iframe:
            src = iframe.get_attribute("src")
            print("iframe src:", src)
            # 检查 iframe 内容是否加载成功
            try:
                frame = iframe.content_frame()
                frame.wait_for_selector("body", timeout=5000)
                body_txt = frame.eval_on_selector("body", "el => el.innerText.slice(0,120)")
                print("iframe body ok:", repr(body_txt[:80]))
            except Exception as e:
                errors.append(f"[iframe] 加载失败: {e}")
        else:
            print("点击后无 iframe 出现")
        pg.screenshot(path=f"{OUT}/d-detail-run.png")
    else:
        print("未找到运行按钮")
        print(pg.content()[:0])

    # about 页
    pg.goto(BASE + "/about/", wait_until="networkidle")
    pg.wait_for_timeout(900)
    pg.screenshot(path=f"{OUT}/d-about.png")

    # 404
    pg.goto(BASE + "/nonexistent/", wait_until="networkidle")
    pg.wait_for_timeout(600)
    pg.screenshot(path=f"{OUT}/d-404.png")

    pg.close()

    # ---- 移动端 ----
    mp = b.new_page(viewport={"width": 375, "height": 720})
    mp.on("console", lambda m: errors.append(f"[mobile console.{m.type}] {m.text}") if m.type in ("error",) else None)
    mp.on("pageerror", lambda e: errors.append(f"[mobile pageerror] {e}"))
    mp.goto(BASE + "/", wait_until="networkidle")
    mp.wait_for_timeout(1600)
    mp.screenshot(path=f"{OUT}/m-hero.png")
    # 横向溢出检查
    overflow = mp.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print("mobile overflow px:", overflow)
    if overflow > 1:
        errors.append(f"[mobile] 横向溢出 {overflow}px")
    mp.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    mp.wait_for_timeout(800)
    mp.screenshot(path=f"{OUT}/m-foot.png")
    mp.goto(BASE + "/works/", wait_until="networkidle")
    mp.wait_for_timeout(700)
    ov2 = mp.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print("mobile works overflow px:", ov2)
    if ov2 > 1:
        errors.append(f"[mobile works] 横向溢出 {ov2}px")
    mp.close()
    b.close()

print("---- errors ----")
if errors:
    for e in errors:
        print(e)
    sys.exit(1)
print("none")
