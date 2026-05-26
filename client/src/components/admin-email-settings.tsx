import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, TestTube, Save, AlertCircle } from "lucide-react";

interface EmailSettings {
  provider: string;
  email: string;
  password: string;
  host: string;
  port: number;
  secure: boolean;
  fromName: string;
}

export default function AdminEmailSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<EmailSettings>({
    provider: 'gmail',
    email: '',
    password: '',
    host: '',
    port: 587,
    secure: true,
    fromName: 'ViVi Beauty'
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const { data: currentSettings, isLoading } = useQuery<EmailSettings>({
    queryKey: ['/api/admin/email-settings']
  });

  // Update settings when data is loaded
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  const saveEmailSettings = useMutation({
    mutationFn: async (emailSettings: EmailSettings) => {
      const response = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings)
      });
      if (!response.ok) {
        throw new Error('Ошибка при сохранении настроек');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Настройки сохранены",
        description: "Настройки email успешно сохранены"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const testEmailConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Тест успешен",
          description: "Подключение к почтовому серверу работает"
        });
      } else {
        toast({
          title: "Ошибка подключения",
          description: result.error || "Не удалось подключиться к почтовому серверу",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка при тестировании подключения",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    const providerSettings = {
      gmail: { host: 'smtp.gmail.com', port: 587, secure: true },
      yandex: { host: 'smtp.yandex.ru', port: 587, secure: true },
      mailru: { host: 'smtp.mail.ru', port: 587, secure: true },
      custom: { host: '', port: 587, secure: true }
    };

    const newSettings = providerSettings[provider as keyof typeof providerSettings];
    setSettings(prev => ({
      ...prev,
      provider,
      ...newSettings
    }));
  };

  const handleInputChange = (field: keyof EmailSettings, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return <div className="p-6">Загрузка настроек...</div>;
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Настройки почты
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            Для Gmail используйте пароль приложения, а не основной пароль аккаунта
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Провайдер</Label>
            <Select value={settings.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="yandex">Yandex</SelectItem>
                <SelectItem value="mailru">Mail.ru</SelectItem>
                <SelectItem value="custom">Другой</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={settings.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Пароль</Label>
          <Input
            type="password"
            value={settings.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Пароль или пароль приложения"
          />
        </div>

        <div className="space-y-2">
          <Label>Имя отправителя</Label>
          <Input
            value={settings.fromName}
            onChange={(e) => handleInputChange('fromName', e.target.value)}
            placeholder="ViVi Beauty"
          />
        </div>

        {settings.provider === 'custom' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>SMTP сервер</Label>
              <Input
                value={settings.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Порт</Label>
              <Input
                type="number"
                value={settings.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => saveEmailSettings.mutate(settings)}
            disabled={saveEmailSettings.isPending}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saveEmailSettings.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>

          <Button
            variant="outline"
            onClick={testEmailConnection}
            disabled={isTestingConnection || !settings.email || !settings.password}
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isTestingConnection ? 'Тестирование...' : 'Тест подключения'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}