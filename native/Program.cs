using System;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CityStoryPC;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

public class MainForm : Form
{
    private readonly WebView2 _webView;
    private readonly string _saveFilePath;
    private readonly string _webDir;
    private bool _isFullscreen;
    private FormBorderStyle _prevBorder;
    private FormWindowState _prevState;

    public MainForm()
    {
        Text = "City Story — PC Edition";
        Width = 1280;
        Height = 820;
        MinimumSize = new Size(900, 600);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(158, 188, 88);
        KeyPreview = true;

        var exeDir = AppContext.BaseDirectory;
        var icoPath = Path.Combine(exeDir, "app.ico");
        if (File.Exists(icoPath))
        {
            try { Icon = new Icon(icoPath); } catch { }
        }

        _webDir = ResolveWebDir(exeDir);

        var saveDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CityStoryPC"
        );
        Directory.CreateDirectory(saveDir);
        _saveFilePath = Path.Combine(saveDir, "save.json");

        _webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_webView);

        Load += async (_, _) => await InitWebViewAsync();
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.F11)
            {
                ToggleFullscreen();
                e.Handled = true;
            }
        };
    }

    private static string ResolveWebDir(string exeDir)
    {
        var candidates = new[]
        {
            Path.Combine(exeDir, "web"),
            Path.GetFullPath(Path.Combine(exeDir, "..", "web")),
            Path.GetFullPath(Path.Combine(exeDir, "..", "..", "..", "..", "web"))
        };
        foreach (var c in candidates)
        {
            if (File.Exists(Path.Combine(c, "index.html"))) return c;
        }
        return Path.Combine(exeDir, "web");
    }

    private void ToggleFullscreen()
    {
        if (!_isFullscreen)
        {
            _prevBorder = FormBorderStyle;
            _prevState = WindowState;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            _isFullscreen = true;
        }
        else
        {
            FormBorderStyle = _prevBorder;
            WindowState = _prevState;
            _isFullscreen = false;
        }
    }

    private async System.Threading.Tasks.Task InitWebViewAsync()
    {
        try
        {
            var userDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CityStoryPC",
                "WebView2Data"
            );
            var env = await CoreWebView2Environment.CreateAsync(null, userDataDir);
            await _webView.EnsureCoreWebView2Async(env);

            var core = _webView.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = true;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;

            core.SetVirtualHostNameToFolderMapping(
                "citystory.local",
                _webDir,
                CoreWebView2HostResourceAccessKind.Allow
            );

            core.WebMessageReceived += (_, e) =>
            {
                try
                {
                    using var doc = JsonDocument.Parse(e.WebMessageAsJson);
                    var type = doc.RootElement.GetProperty("type").GetString();
                    if (type == "requestSave")
                    {
                        if (File.Exists(_saveFilePath))
                        {
                            var json = File.ReadAllText(_saveFilePath);
                            var payload = JsonSerializer.Serialize(new { type = "loadSave", json });
                            core.PostWebMessageAsJson(payload);
                        }
                    }
                    else if (type == "save")
                    {
                        var json = doc.RootElement.GetProperty("json").GetString();
                        if (!string.IsNullOrEmpty(json))
                        {
                            File.WriteAllText(_saveFilePath, json);
                        }
                    }
                }
                catch { }
            };

            core.Navigate("https://citystory.local/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Failed to initialize City Story window:\n{ex.Message}",
                "City Story PC",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
