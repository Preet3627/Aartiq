param(
    [string]$ToolName = "Unknown Tool",
    [string]$Risk = "medium",
    [string]$Args = "",
    [string]$RequestId = ""
)

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Aartiq - MCP Approval"
        Width="480" Height="Auto" MinHeight="420"
        WindowStartupLocation="CenterScreen"
        Background="#0A0A1A"
        ResizeMode="NoResize"
        Topmost="True"
        FontFamily="Segoe UI">
    <Window.Resources>
        <Style x:Key="CardBorder" TargetType="Border">
            <Setter Property="Background" Value="#111827"/>
            <Setter Property="CornerRadius" Value="12"/>
            <Setter Property="Padding" Value="20"/>
            <Setter Property="Margin" Value="0,0,0,12"/>
        </Style>
    </Window.Resources>
    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- Header -->
        <StackPanel Grid.Row="0" Orientation="Horizontal" Margin="0,0,0,16">
            <Border Background="#1F2937" CornerRadius="8" Width="36" Height="36" Margin="0,0,12,0">
                <TextBlock Text="&#x26A1;" FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <StackPanel VerticalAlignment="Center">
                <TextBlock Text="MCP Tool Approval" FontSize="16" FontWeight="Bold" Foreground="#F8FAFC"/>
                <TextBlock Name="RiskLabel" Text="RISK" FontSize="9" FontWeight="Bold" Foreground="#94A3B8" CharacterSpacing="80"/>
            </StackPanel>
            <Border Name="RiskBadge" CornerRadius="10" Padding="8,3" HorizontalAlignment="Right" VerticalAlignment="Center">
                <TextBlock Name="RiskBadgeText" FontSize="9" FontWeight="Bold" Foreground="White"/>
            </Border>
        </StackPanel>

        <!-- Tool Info -->
        <Border Grid.Row="1" Style="{StaticResource CardBorder}">
            <StackPanel>
                <TextBlock Text="TOOL" FontSize="9" FontWeight="Bold" Foreground="#64748B" Margin="0,0,0,4"/>
                <TextBlock Name="ToolName" FontSize="13" FontWeight="SemiBold" Foreground="#A78BFA" FontFamily="Consolas"/>
            </StackPanel>
        </Border>

        <!-- Arguments -->
        <Border Grid.Row="2" Background="#0D1117" CornerRadius="8" Padding="12" Margin="0,0,0,12">
            <StackPanel>
                <TextBlock Text="ARGUMENTS" FontSize="9" FontWeight="Bold" Foreground="#64748B" Margin="0,0,0,6"/>
                <TextBlock Name="ArgsText" FontSize="11" Foreground="#94A3B8" FontFamily="Consolas" TextWrapping="Wrap" MaxHeight="120"/>
            </StackPanel>
        </Border>

        <!-- Warning for high risk -->
        <Border Name="WarningPanel" Grid.Row="3" Background="#3B1111" CornerRadius="8" Padding="12" Margin="0,0,0,12" Visibility="Collapsed">
            <StackPanel>
                <TextBlock FontSize="10" FontWeight="Bold" Foreground="#EF4444" Text="&#x26A0; DESTRUCTIVE COMMAND DETECTED" Margin="0,0,0,4"/>
                <TextBlock FontSize="11" Foreground="#FCA5A5" TextWrapping="Wrap" Text="This command can permanently modify or destroy data. Approval requires explicit confirmation."/>
            </StackPanel>
        </Border>

        <!-- Source -->
        <Border Grid.Row="4" Background="#1A1A2E" CornerRadius="8" Padding="12" Margin="0,0,0,12">
            <StackPanel>
                <TextBlock Text="SOURCE" FontSize="9" FontWeight="Bold" Foreground="#64748B" Margin="0,0,0,4"/>
                <TextBlock Text="Claude Desktop via MCP" FontSize="11" Foreground="#7C3AED"/>
            </StackPanel>
        </Border>

        <!-- Buttons -->
        <Grid Grid.Row="5">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="12"/>
                <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>

            <Button Grid.Column="0" Name="DenyBtn" Height="38" Cursor="Hand">
                <Button.Template>
                    <ControlTemplate TargetType="Button">
                        <Border Background="#1F2937" CornerRadius="8" BorderBrush="#374151" BorderThickness="1">
                            <TextBlock Text="Deny" FontSize="13" FontWeight="SemiBold" Foreground="#94A3B8" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Button.Template>
            </Button>

            <Button Grid.Column="2" Name="ApproveBtn" Height="38" Cursor="Hand">
                <Button.Template>
                    <ControlTemplate TargetType="Button">
                        <Border Name="ApproveBorder" Background="#7C3AED" CornerRadius="8">
                            <TextBlock Text="Approve" FontSize="13" FontWeight="Bold" Foreground="White" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Button.Template>
            </Button>
        </Grid>

        <!-- Shortcut hint -->
        <TextBlock Grid.Row="5" Text="Shift+Tab to approve  |  Esc to deny" FontSize="9" Foreground="#475569" HorizontalAlignment="Center" VerticalAlignment="Bottom" Margin="0,8,0,-20"/>
    </Grid>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
$window = [System.Windows.Markup.XamlReader]::Load($reader)

$window.FindName("ToolName").Text = $ToolName
$window.FindName("ArgsText").Text = $Args

$riskBadge = $window.FindName("RiskBadge")
$riskBadgeText = $window.FindName("RiskBadgeText")
$riskLabel = $window.FindName("RiskLabel")
$warningPanel = $window.FindName("WarningPanel")

switch ($Risk.ToLower()) {
    "high" {
        $riskBadge.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#EF4444")
        $riskBadgeText.Text = "HIGH RISK"
        $riskLabel.Text = "SECURITY ALERT"
        $riskLabel.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#EF4444")
        $warningPanel.Visibility = [System.Windows.Visibility]::Visible
        $approveBtn = $window.FindName("ApproveBtn")
        $approveBtn.Template.FindName("ApproveBorder", $approveBtn).Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#DC2626")
    }
    "medium" {
        $riskBadge.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#F59E0B")
        $riskBadgeText.Text = "MEDIUM RISK"
    }
    default {
        $riskBadge.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#22C55E")
        $riskBadgeText.Text = "LOW RISK"
    }
}

$approved = $false

$window.FindName("DenyBtn").Add_Click({
    $approved = $false
    $window.Close()
})

$window.FindName("ApproveBtn").Add_Click({
    $approved = $true
    $window.Close()
})

$window.Add_KeyDown({
    param($sender, $e)
    if ($e.Key -eq 'Escape') {
        $approved = $false
        $window.Close()
    }
    if ($e.Key -eq 'Tab' -and [System.Windows.Input.Keyboard]::Modifiers -band [System.Windows.Input.ModifierKeys]::Shift) {
        $approved = $true
        $window.Close()
    }
})

$window.ShowDialog() | Out-Null

$output = @{
    requestId = $RequestId
    approved = $approved
} | ConvertTo-Json

Write-Output $output
