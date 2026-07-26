"""Excel 文件比对工具 — 极简风格 GUI"""

import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

from compare import BASE_DIR, run_compare


# ── 色彩与样式常量 ──────────────────────────────────────
COLOR_BG = "#F8F9FA"
COLOR_CARD = "#FFFFFF"
COLOR_PRIMARY = "#2563EB"
COLOR_PRIMARY_HOVER = "#1D4ED8"
COLOR_PRIMARY_ACTIVE = "#1E40AF"
COLOR_PRIMARY_LIGHT = "#EFF6FF"
COLOR_TEXT = "#1E293B"
COLOR_TEXT_SECONDARY = "#94A3B8"
COLOR_TEXT_PLACEHOLDER = "#CBD5E1"
COLOR_BORDER = "#E2E8F0"
COLOR_SUCCESS = "#16A34A"
COLOR_ERROR = "#DC2626"
FONT_FAMILY = "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif"
OUTPUT_FILENAME = "变更记录.xlsx"

# ── 辅助函数 ────────────────────────────────────────────


def _short_path(path: str, max_len: int = 55) -> str:
    """截断过长的路径，保留首尾"""
    if len(path) <= max_len:
        return path
    half = (max_len - 3) // 2
    return path[:half] + "..." + path[-half:]


class ContextMenu:
    """为 Entry 提供右键菜单"""

    def __init__(self, entry: tk.Entry) -> None:
        self.entry = entry
        self.menu = tk.Menu(entry, tearoff=0, font=(FONT_FAMILY, 10))
        self.menu.add_command(label="复制路径", command=self._copy, accelerator="Ctrl+C")
        self.menu.add_command(label="粘贴", command=self._paste, accelerator="Ctrl+V")
        self.menu.add_separator()
        self.menu.add_command(label="清空", command=self._clear)
        entry.bind("<Button-3>", self._popup)

    def _popup(self, event: tk.Event) -> None:
        self.menu.tk_popup(event.x_root, event.y_root)

    def _copy(self) -> None:
        self.entry.event_generate("<<Copy>>")

    def _paste(self) -> None:
        self.entry.event_generate("<<Paste>>")

    def _clear(self) -> None:
        self.entry.delete(0, tk.END)


class CompareApp:
    def __init__(self) -> None:
        self.output_file_path: str | None = None
        self._running = False

        self.root = tk.Tk()
        self.root.title("Excel 文件比对")
        self.root.geometry("640x540")
        self.root.minsize(560, 480)
        self.root.configure(bg=COLOR_BG)

        self._build_ui()
        self._center_window()
        self._bind_shortcuts()
        self._show_placeholder()

    # ── 窗口定位 ─────────────────────────────────────────
    def _center_window(self) -> None:
        self.root.update_idletasks()
        w, h = 640, 540
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.root.geometry(f"{w}x{h}+{(sw - w) // 2}+{(sh - h) // 2}")

    # ── 快捷键 ───────────────────────────────────────────
    def _bind_shortcuts(self) -> None:
        self.root.bind("<Control-o>", lambda _: self._browse_old())
        self.root.bind("<Control-n>", lambda _: self._browse_new())
        self.root.bind("<Control-Return>", lambda _: self._run())
        self.root.bind("<Return>", lambda _: self._run())

    # ── 构建界面 ─────────────────────────────────────────
    def _build_ui(self) -> None:
        # ── 容器 ───────────────────────────────────────
        container = tk.Frame(self.root, bg=COLOR_BG)
        container.pack(fill=tk.BOTH, expand=True, padx=24, pady=(20, 0))

        # ── 标题行 ─────────────────────────────────────
        title_frame = tk.Frame(container, bg=COLOR_BG)
        title_frame.pack(fill=tk.X, pady=(0, 20))

        tk.Label(
            title_frame,
            text="Excel 文件比对",
            font=(FONT_FAMILY, 18, "bold"),
            bg=COLOR_BG,
            fg=COLOR_TEXT,
            anchor="w",
        ).pack(side=tk.LEFT)

        self.status_icon = tk.Label(
            title_frame,
            text="",
            font=(FONT_FAMILY, 12),
            bg=COLOR_BG,
            fg=COLOR_TEXT_SECONDARY,
            anchor="e",
        )
        self.status_icon.pack(side=tk.RIGHT)

        # ── 卡片 ───────────────────────────────────────
        card = tk.Frame(
            container,
            bg=COLOR_CARD,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
        )
        card.pack(fill=tk.X, pady=(0, 16))

        inner = tk.Frame(card, bg=COLOR_CARD)
        inner.pack(fill=tk.X, padx=20, pady=20)

        # ── 文件选择行 ─────────────────────────────────
        def make_file_row(
            parent: tk.Frame, label: str, var: tk.StringVar, browse_cb, tip: str
        ) -> tuple[tk.Entry, tk.Label]:
            row = tk.Frame(parent, bg=COLOR_CARD)
            row.pack(fill=tk.X, pady=(0, 14))

            tk.Label(
                row,
                text=label,
                font=(FONT_FAMILY, 12),
                bg=COLOR_CARD,
                fg=COLOR_TEXT,
                anchor="w",
                width=8,
            ).pack(side=tk.LEFT)

            entry = tk.Entry(
                row,
                textvariable=var,
                font=(FONT_FAMILY, 10),
                bg="#F1F5F9",
                fg=COLOR_TEXT,
                relief=tk.FLAT,
                highlightthickness=1,
                highlightbackground=COLOR_BORDER,
                highlightcolor=COLOR_PRIMARY,
                insertbackground=COLOR_TEXT,
            )
            entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8), ipady=4)
            ContextMenu(entry)

            btn = tk.Label(
                row,
                text="选择文件",
                font=(FONT_FAMILY, 11),
                bg=COLOR_PRIMARY_LIGHT,
                fg=COLOR_PRIMARY,
                cursor="hand2",
                padx=14,
                pady=4,
            )
            btn.pack(side=tk.RIGHT)
            btn.bind("<Button-1>", lambda _: browse_cb())
            btn.bind(
                "<Enter>", lambda _, b=btn: b.configure(bg="#DBEAFE") if str(b["bg"]) != "#94A3B8" else None
            )
            btn.bind(
                "<Leave>", lambda _, b=btn: b.configure(bg=COLOR_PRIMARY_LIGHT) if str(b["bg"]) != "#94A3B8" else None
            )

            return entry, btn

        self.old_var = tk.StringVar()
        self.new_var = tk.StringVar()
        self.out_var = tk.StringVar(value=BASE_DIR)

        self.old_entry, self.old_btn = make_file_row(
            inner, "原文件", self.old_var, self._browse_old, "旧版 Excel"
        )
        self.new_entry, self.new_btn = make_file_row(
            inner, "比对文件", self.new_var, self._browse_new, "新版 Excel"
        )

        # ── 输出行 ─────────────────────────────────────
        out_row = tk.Frame(inner, bg=COLOR_CARD)
        out_row.pack(fill=tk.X, pady=(0, 0))

        tk.Label(
            out_row,
            text="输出至",
            font=(FONT_FAMILY, 12),
            bg=COLOR_CARD,
            fg=COLOR_TEXT,
            anchor="w",
            width=8,
        ).pack(side=tk.LEFT)

        self.out_entry = tk.Entry(
            out_row,
            textvariable=self.out_var,
            font=(FONT_FAMILY, 10),
            bg="#F1F5F9",
            fg=COLOR_TEXT_SECONDARY,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightbackground=COLOR_BORDER,
            highlightcolor=COLOR_PRIMARY,
            insertbackground=COLOR_TEXT,
        )
        self.out_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8), ipady=4)
        ContextMenu(self.out_entry)

        out_btn = tk.Label(
            out_row,
            text="选择目录",
            font=(FONT_FAMILY, 11),
            bg=COLOR_PRIMARY_LIGHT,
            fg=COLOR_PRIMARY,
            cursor="hand2",
            padx=14,
            pady=4,
        )
        out_btn.pack(side=tk.RIGHT)
        out_btn.bind("<Button-1>", lambda _: self._browse_out())
        out_btn.bind(
            "<Enter>",
            lambda _, b=out_btn: b.configure(bg="#DBEAFE") if str(b["bg"]) != "#94A3B8" else None,
        )
        out_btn.bind(
            "<Leave>",
            lambda _, b=out_btn: b.configure(bg=COLOR_PRIMARY_LIGHT) if str(b["bg"]) != "#94A3B8" else None,
        )

        # ── 进度条 ─────────────────────────────────────
        self.progress = ttk.Progressbar(container, mode="indeterminate")
        self.progress.pack(fill=tk.X, pady=(0, 16))
        self.progress.pack_forget()

        # ── 操作行 ─────────────────────────────────────
        action_row = tk.Frame(container, bg=COLOR_BG)
        action_row.pack(fill=tk.X, pady=(0, 12))

        self.run_btn = tk.Label(
            action_row,
            text="开始比对",
            font=(FONT_FAMILY, 13, "bold"),
            bg=COLOR_PRIMARY,
            fg="white",
            cursor="hand2",
            anchor="center",
            padx=32,
            pady=8,
        )
        self.run_btn.pack()
        self._bind_run_btn()

        # ── 日志区域 ───────────────────────────────────
        log_container = tk.Frame(container, bg=COLOR_BG)
        log_container.pack(fill=tk.BOTH, expand=True, pady=(0, 0))

        log_header = tk.Frame(log_container, bg=COLOR_BG)
        log_header.pack(fill=tk.X, pady=(0, 6))

        tk.Label(
            log_header,
            text="运行日志",
            font=(FONT_FAMILY, 11),
            bg=COLOR_BG,
            fg=COLOR_TEXT_SECONDARY,
            anchor="w",
        ).pack(side=tk.LEFT)

        self.open_link = tk.Label(
            log_header,
            text="",
            font=(FONT_FAMILY, 10),
            bg=COLOR_BG,
            fg=COLOR_PRIMARY,
            cursor="hand2",
            anchor="e",
        )
        self.open_link.pack(side=tk.RIGHT)
        self.open_link.bind("<Button-1>", lambda _: self._open_output())

        self.log_text = scrolledtext.ScrolledText(
            log_container,
            wrap=tk.WORD,
            font=(FONT_FAMILY, 10),
            bg="#F8FAFC",
            fg="#475569",
            relief=tk.FLAT,
            highlightthickness=1,
            highlightbackground=COLOR_BORDER,
            borderwidth=0,
            padx=12,
            pady=8,
            state=tk.DISABLED,
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # ── 状态栏 ─────────────────────────────────────
        self.status_bar = tk.Label(
            self.root,
            text="就绪  ·  Ctrl+O 原文件  ·  Ctrl+N 比对文件  ·  Enter 开始比对",
            font=(FONT_FAMILY, 10),
            bg="#F1F5F9",
            fg=COLOR_TEXT_SECONDARY,
            anchor="w",
            padx=16,
            pady=6,
        )
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM)

    # ── 按钮绑定 ─────────────────────────────────────────
    def _bind_run_btn(self) -> None:
        self.run_btn.configure(cursor="hand2")
        self.run_btn.bind("<Button-1>", self._on_run_click)
        self.run_btn.bind("<Enter>", lambda _: self.run_btn.configure(bg=COLOR_PRIMARY_HOVER))
        self.run_btn.bind("<Leave>", lambda _: self.run_btn.configure(bg=COLOR_PRIMARY))
        self.run_btn.bind("<ButtonRelease-1>", lambda _: self.run_btn.configure(bg=COLOR_PRIMARY_HOVER))

    def _on_run_click(self, event: tk.Event) -> None:
        self.run_btn.configure(bg=COLOR_PRIMARY_ACTIVE)
        self.root.after(80, self._run)

    # ── 空状态引导 ───────────────────────────────────────
    def _show_placeholder(self) -> None:
        self._clear_log()
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(
            tk.END,
            "📂 选择原文件和比对文件后，点击「开始比对」\n"
            "💡 也可以拖拽文件到输入框，或使用快捷键\n\n"
            "   Ctrl+O    打开原文件\n"
            "   Ctrl+N    打开比对文件\n"
            "   Enter     开始比对\n",
        )
        self.log_text.configure(state=tk.DISABLED)

    # ── 文件选择 ─────────────────────────────────────────
    def _browse_old(self) -> None:
        path = filedialog.askopenfilename(
            title="选择原文件",
            initialdir=BASE_DIR,
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")],
        )
        if path:
            self.old_var.set(path)
            self._validate_file(path, self.old_entry)

    def _browse_new(self) -> None:
        path = filedialog.askopenfilename(
            title="选择比对文件",
            initialdir=BASE_DIR,
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")],
        )
        if path:
            self.new_var.set(path)
            self._validate_file(path, self.new_entry)

    def _browse_out(self) -> None:
        path = filedialog.askdirectory(title="选择输出目录", initialdir=BASE_DIR)
        if path:
            self.out_var.set(path)

    def _validate_file(self, path: str, entry: tk.Entry) -> None:
        color = COLOR_SUCCESS if os.path.isfile(path) and path.endswith(".xlsx") else COLOR_ERROR
        entry.configure(highlightbackground=color)

    # ── 输出文件快捷操作 ─────────────────────────────────
    def _open_output(self) -> None:
        if self.output_file_path and os.path.isfile(self.output_file_path):
            os.startfile(os.path.dirname(self.output_file_path))

    # ── 执行比对 ─────────────────────────────────────────
    def _run(self) -> None:
        if self._running:
            return

        old_file = self.old_var.get().strip()
        new_file = self.new_var.get().strip()
        out_dir = self.out_var.get().strip()

        if not old_file or not new_file:
            self._status("请先选择原文件和比对文件", COLOR_ERROR)
            self._append_log("⛔ 请选择原文件和比对文件后再开始")
            return

        if not os.path.isfile(old_file):
            self._status("原文件不存在", COLOR_ERROR)
            self._append_log(f"⛔ 原文件不存在:\n{_short_path(old_file, 80)}")
            return

        if not os.path.isfile(new_file):
            self._status("比对文件不存在", COLOR_ERROR)
            self._append_log(f"⛔ 比对文件不存在:\n{_short_path(new_file, 80)}")
            return

        if not os.path.isdir(out_dir):
            out_dir = os.path.dirname(out_dir) or os.getcwd()

        output_file = os.path.join(out_dir, OUTPUT_FILENAME)

        # 覆盖提醒
        if os.path.isfile(output_file):
            if not messagebox.askyesno(
                "文件已存在",
                f"「{OUTPUT_FILENAME}」已存在，是否覆盖？",
                icon="warning",
            ):
                return

        self._running = True

        # UI 状态：运行中
        self.run_btn.configure(bg="#94A3B8", cursor="watch")
        self.run_btn.unbind("<Button-1>")
        self.run_btn.unbind("<ButtonRelease-1>")
        self.status_icon.configure(text="⏳", fg=COLOR_TEXT_SECONDARY)
        self.open_link.configure(text="")
        self._status("正在比对...")
        self._clear_log()
        self._append_log(f"📄 原文件:   {os.path.basename(old_file)}")
        self._append_log(f"📄 比对文件: {os.path.basename(new_file)}")
        self._append_log(f"📁 输出至:   {_short_path(output_file, 80)}")
        self._append_log("─" * 40)

        self.progress.pack(fill=tk.X, pady=(0, 16))
        self.progress.start(10)

        t = threading.Thread(
            target=self._run_in_thread,
            args=(old_file, new_file, output_file),
            daemon=True,
        )
        t.start()

    def _run_in_thread(
        self, old_file: str, new_file: str, output_file: str
    ) -> None:
        import logging

        class TextHandler(logging.Handler):
            def __init__(self, text_widget):
                super().__init__()
                self.text_widget = text_widget

            def emit(self, record):
                msg = self.format(record)
                self.text_widget.after(0, lambda m=msg: self._append(m))

            def _append(self, msg):
                self.text_widget.configure(state=tk.NORMAL)
                self.text_widget.insert(tk.END, msg + "\n")
                self.text_widget.see(tk.END)
                self.text_widget.configure(state=tk.DISABLED)

        logger = logging.getLogger()
        handler = TextHandler(self.log_text)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)

        try:
            count = run_compare(old_file, new_file, output_file)
            self.log_text.after(0, lambda c=count, p=output_file: self._on_success(c, p))
        except Exception as e:
            self.log_text.after(0, lambda err=e: self._on_error(err))
        finally:
            logger.removeHandler(handler)
            self.log_text.after(0, self._stop_progress)

    def _on_success(self, count: int, output_path: str) -> None:
        self.output_file_path = output_path
        self._append_log("─" * 40)
        self._append_log(f"✅ 比对完成，共检测到 {count} 条变更记录")
        self.status_icon.configure(text="✓", fg=COLOR_SUCCESS)
        self._status(f"完成，共 {count} 条变更")
        self.open_link.configure(text="📂 打开输出目录")
        self._reset_run_btn()

    def _on_error(self, error: Exception) -> None:
        self._append_log("─" * 40)
        self._append_log(f"❌ {error}")
        self.status_icon.configure(text="✗", fg=COLOR_ERROR)
        self._status("比对出错，请检查文件")
        self._reset_run_btn()

    def _stop_progress(self) -> None:
        self.progress.stop()
        self.progress.pack_forget()

    def _reset_run_btn(self) -> None:
        self._running = False
        self.run_btn.configure(bg=COLOR_PRIMARY)
        self._bind_run_btn()

    # ── 状态与日志 ───────────────────────────────────────
    def _status(self, text: str, color: str | None = None) -> None:
        self.status_bar.configure(text=text, fg=color or COLOR_TEXT_SECONDARY)

    def _append_log(self, message: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _clear_log(self) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    app = CompareApp()
    app.run()
