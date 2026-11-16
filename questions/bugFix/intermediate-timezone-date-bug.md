---
id: intermediate-timezone-date-bug
slug: intermediate-timezone-date-bug
title: Correção de Bug — Inconsistência de Timezone em Relatórios
axis: bugFix
subtheme: integration_and_performance
difficulty: intermediate
promptTemplate: intermediate-timezone-date-bug
supportedLanguages: [javascript, python, java]
defaultLanguage: javascript
tags: [exception_handling, logic_bug]
inputConfig:
  type: code
rubric:
  version: v1
  criteria:
    - id: bug_identification
      name: Identificação do bug
      weight: 0.25
      description: Identifica corretamente o problema de conversão de timezone (uso de Date local vs UTC, falta de normalização).
    - id: fix_correctness
      name: Correção adequada
      weight: 0.35
      description: Corrige armazenando/processando datas em UTC, converte para timezone local apenas na apresentação, usa biblioteca apropriada.
    - id: edge_cases
      name: Tratamento de casos extremos
      weight: 0.20
      description: Trata horário de verão (DST), mudanças de fuso durante período de relatório, datas no limite de meia-noite.
    - id: code_quality
      name: Qualidade do código
      weight: 0.20
      description: Código limpo, usa biblioteca de datas moderna (date-fns, luxon, moment-timezone / datetime, pytz / java.time), evita lógica manual de timezone.
---

<!-- SECTION:statement -->
Um sistema de relatórios financeiros apresenta inconsistências quando usuários de diferentes regiões consultam dados do mesmo dia. Vendas registradas em São Paulo (UTC-3) aparecem com datas diferentes para usuários em Tóquio (UTC+9).

**Problema específico:**

Um cliente em São Paulo registra uma venda às **23:30 do dia 15/03/2024** (horário local). O sistema salva no banco de dados usando `new Date()` (JavaScript), `datetime.now()` (Python) ou `LocalDateTime.now()` (Java).

Quando o relatório de vendas do dia **15/03/2024** é gerado:
- **Usuário em São Paulo:** vê a venda corretamente no dia 15/03
- **Usuário em Tóquio:** vê a venda no dia **16/03** (porque 23:30 UTC-3 = 02:30+1d UTC+9)

**Requisitos da correção:**

1. **Armazenamento consistente:** datas devem ser salvas sempre em **UTC** no banco
2. **Conversão correta:** ao gerar relatório, converter de UTC para timezone do usuário apenas na apresentação
3. **Filtros de data:** filtros como "vendas do dia 15/03" devem considerar o dia completo no timezone do usuário (00:00 a 23:59 local → converter para range UTC)
4. **Evitar lógica manual:** usar biblioteca confiável de timezone (evitar cálculos manuais de offset)

**Código com bug está no template ao lado.**
<!-- /SECTION:statement -->

<!-- SECTION:template:javascript -->
// Sistema de relatórios com bug de timezone
const express = require('express');
const app = express();

// Simulação de banco de dados (em produção seria PostgreSQL/MongoDB)
const sales = [];

// Endpoint para registrar venda
app.post('/sales', (req, res) => {
  const { amount, customerId } = req.body;
  
  // BUG: Salva data local do servidor, não UTC
  const sale = {
    id: sales.length + 1,
    amount,
    customerId,
    saleDate: new Date(), // Usa timezone local do servidor
    createdAt: Date.now()
  };
  
  sales.push(sale);
  res.json({ success: true, sale });
});

// Endpoint para gerar relatório de vendas do dia
app.get('/reports/daily', (req, res) => {
  const { date, timezone } = req.query; // ex: date=2024-03-15, timezone=America/Sao_Paulo
  
  // BUG: Compara datas sem considerar timezone
  const targetDate = new Date(date);
  
  const dailySales = sales.filter(sale => {
    // Compara usando Date do JavaScript (ambíguo)
    const saleDay = sale.saleDate.toISOString().split('T')[0];
    const targetDay = targetDate.toISOString().split('T')[0];
    return saleDay === targetDay;
  });
  
  // BUG: Retorna datas sem conversão para timezone do usuário
  const report = dailySales.map(sale => ({
    id: sale.id,
    amount: sale.amount,
    // Formata data sem considerar timezone do usuário
    saleDate: sale.saleDate.toLocaleString('pt-BR')
  }));
  
  res.json({ date, timezone, sales: report, total: report.length });
});

// Função auxiliar com bug adicional
function getDateRangeForDay(dateString, timezone) {
  // BUG: Cria range sem considerar timezone
  const start = new Date(dateString);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(dateString);
  end.setHours(23, 59, 59, 999);
  
  return { start, end }; // Retorna datas locais, não UTC
}

app.listen(3000, () => console.log('Server running on port 3000'));
<!-- /SECTION:template:javascript -->

<!-- SECTION:template:python -->
# Sistema de relatórios com bug de timezone
from flask import Flask, request, jsonify
from datetime import datetime
import json

app = Flask(__name__)

# Simulação de banco de dados
sales = []

# Endpoint para registrar venda
@app.route('/sales', methods=['POST'])
def create_sale():
    data = request.json
    amount = data.get('amount')
    customer_id = data.get('customerId')
    
    # BUG: Usa datetime local do servidor
    sale = {
        'id': len(sales) + 1,
        'amount': amount,
        'customerId': customer_id,
        'saleDate': datetime.now(),  # Timezone local, não UTC
        'createdAt': datetime.now().timestamp()
    }
    
    sales.append(sale)
    
    # BUG: Serializa datetime sem timezone info
    return jsonify({
        'success': True,
        'sale': {
            **sale,
            'saleDate': sale['saleDate'].isoformat()  # Sem timezone
        }
    })

# Endpoint para gerar relatório de vendas do dia 
@app.route('/reports/daily', methods=['GET'])
def daily_report():
    date_str = request.args.get('date')  # ex: 2024-03-15
    timezone = request.args.get('timezone')  # ex: America/Sao_Paulo
    
    # BUG: Parse sem timezone
    target_date = datetime.fromisoformat(date_str)
    
    daily_sales = []
    for sale in sales:
        # Compara datas naive (sem timezone)
        sale_day = sale['saleDate'].date()
        target_day = target_date.date()
        
        if sale_day == target_day:
            daily_sales.append(sale)
    
    # BUG: Formata sem conversão de timezone
    report = []
    for sale in daily_sales:
        report.append({
            'id': sale['id'],
            'amount': sale['amount'],
            # Formato sem timezone do usuário
            'saleDate': sale['saleDate'].strftime('%d/%m/%Y %H:%M:%S')
        })
    
    return jsonify({
        'date': date_str,
        'timezone': timezone,
        'sales': report,
        'total': len(report)
    })

# Função auxiliar com bug adicional
def get_date_range_for_day(date_str, timezone):
    # BUG: Cria range sem timezone awareness
    date = datetime.fromisoformat(date_str)
    
    start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    return {'start': start, 'end': end}  # Naive datetimes

if __name__ == '__main__':
    app.run(port=3000)
<!-- /SECTION:template:python -->

<!-- SECTION:template:java -->
// Sistema de relatórios com bug de timezone
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

class Sale {
    int id;
    double amount;
    String customerId;
    LocalDateTime saleDate;  // BUG: LocalDateTime não tem timezone
    long createdAt;
    
    public Sale(int id, double amount, String customerId) {
        this.id = id;
        this.amount = amount;
        this.customerId = customerId;
        this.saleDate = LocalDateTime.now();  // Usa timezone local do servidor
        this.createdAt = System.currentTimeMillis();
    }
}

class SalesService {
    private List<Sale> sales = new ArrayList<>();
    
    // Registrar venda
    public Sale createSale(double amount, String customerId) {
        Sale sale = new Sale(sales.size() + 1, amount, customerId);
        sales.add(sale);
        return sale;
    }
    
    // Gerar relatório diário
    public List<SaleReport> getDailyReport(String dateStr, String timezone) {
        // BUG: Parse sem timezone
        LocalDateTime targetDate = LocalDateTime.parse(dateStr + "T00:00:00");
        
        // BUG: Filtra comparando apenas a data local
        return sales.stream()
            .filter(sale -> {
                // Compara datas sem considerar timezone
                return sale.saleDate.toLocalDate().equals(targetDate.toLocalDate());
            })
            .map(sale -> new SaleReport(
                sale.id,
                sale.amount,
                // Formata sem conversão para timezone do usuário
                sale.saleDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
            ))
            .collect(Collectors.toList());
    }
    
    // Função auxiliar com bug adicional
    public DateRange getDateRangeForDay(String dateStr, String timezone) {
        // BUG: Cria range sem timezone awareness
        LocalDateTime date = LocalDateTime.parse(dateStr + "T00:00:00");
        
        LocalDateTime start = date.withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = date.withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        
        return new DateRange(start, end);  // LocalDateTime não tem timezone
    }
}

class SaleReport {
    int id;
    double amount;
    String saleDate;
    
    public SaleReport(int id, double amount, String saleDate) {
        this.id = id;
        this.amount = amount;
        this.saleDate = saleDate;
    }
}

class DateRange {
    LocalDateTime start;
    LocalDateTime end;
    
    public DateRange(LocalDateTime start, LocalDateTime end) {
        this.start = start;
        this.end = end;
    }
}
<!-- /SECTION:template:java -->

<!-- SECTION:solution-outline -->
**Solução esperada:**

### Bugs Identificados

1. **Armazenamento:** `new Date()` / `datetime.now()` / `LocalDateTime.now()` usa timezone local do servidor, não UTC
2. **Comparação:** filtro de data compara strings/datas naive sem normalizar para UTC
3. **Apresentação:** datas retornadas não são convertidas para timezone do usuário
4. **Range de filtro:** função `getDateRangeForDay` cria intervalo em timezone local, não converte para UTC

---

### Correção Completa

#### JavaScript (usando `date-fns-tz`)

```javascript
const express = require('express');
const { utcToZonedTime, zonedTimeToUtc, format } = require('date-fns-tz');
const { parseISO, startOfDay, endOfDay } = require('date-fns');

const app = express();
app.use(express.json());

const sales = [];

// CORRIGIDO: Salva sempre em UTC
app.post('/sales', (req, res) => {
  const { amount, customerId } = req.body;
  
  const sale = {
    id: sales.length + 1,
    amount,
    customerId,
    saleDate: new Date().toISOString(), // Armazena em UTC (ISO 8601)
    createdAt: Date.now()
  };
  
  sales.push(sale);
  res.json({ success: true, sale });
});

// CORRIGIDO: Filtra considerando timezone do usuário
app.get('/reports/daily', (req, res) => {
  const { date, timezone } = req.query; // ex: date=2024-03-15, timezone=America/Sao_Paulo
  
  // 1. Cria range do dia no timezone do usuário
  const userDate = parseISO(date); // 2024-03-15T00:00:00 (naive)
  const startOfDayUser = startOfDay(userDate); // 00:00:00
  const endOfDayUser = endOfDay(userDate);     // 23:59:59.999
  
  // 2. Converte range para UTC
  const startUTC = zonedTimeToUtc(startOfDayUser, timezone);
  const endUTC = zonedTimeToUtc(endOfDayUser, timezone);
  
  // 3. Filtra vendas dentro do range UTC
  const dailySales = sales.filter(sale => {
    const saleDateUTC = new Date(sale.saleDate);
    return saleDateUTC >= startUTC && saleDateUTC <= endUTC;
  });
  
  // 4. Converte datas para timezone do usuário na apresentação
  const report = dailySales.map(sale => ({
    id: sale.id,
    amount: sale.amount,
    saleDate: format(
      utcToZonedTime(new Date(sale.saleDate), timezone),
      'dd/MM/yyyy HH:mm:ss',
      { timeZone: timezone }
    )
  }));
  
  res.json({ date, timezone, sales: report, total: report.length });
});

app.listen(3000);
```

**Bibliotecas necessárias:**
```bash
npm install date-fns date-fns-tz
```

**Exemplo de conversão:**
- Venda em SP: 15/03/2024 23:30 (America/Sao_Paulo)
- UTC: 16/03/2024 02:30
- Filtro "15/03" em SP: 15/03 00:00 BRT → 15/03 03:00 UTC até 16/03 02:59:59 UTC
- Venda **é incluída** no relatório do dia 15 para usuário em SP

---

#### Python (usando `pytz` e `datetime`)

```python
from flask import Flask, request, jsonify
from datetime import datetime, timezone
import pytz

app = Flask(__name__)

sales = []

# CORRIGIDO: Salva sempre em UTC
@app.route('/sales', methods=['POST'])
def create_sale():
    data = request.json
    
    sale = {
        'id': len(sales) + 1,
        'amount': data['amount'],
        'customerId': data['customerId'],
        'saleDate': datetime.now(timezone.utc).isoformat(),  # UTC aware
        'createdAt': datetime.now(timezone.utc).timestamp()
    }
    
    sales.append(sale)
    return jsonify({'success': True, 'sale': sale})

# CORRIGIDO: Filtra considerando timezone
@app.route('/reports/daily', methods=['GET'])
def daily_report():
    date_str = request.args.get('date')  # 2024-03-15
    tz_str = request.args.get('timezone')  # America/Sao_Paulo
    
    # 1. Cria range do dia no timezone do usuário
    user_tz = pytz.timezone(tz_str)
    naive_date = datetime.fromisoformat(date_str)
    
    # Localiza no timezone do usuário
    start_user = user_tz.localize(naive_date.replace(hour=0, minute=0, second=0))
    end_user = user_tz.localize(naive_date.replace(hour=23, minute=59, second=59, microsecond=999999))
    
    # 2. Converte para UTC
    start_utc = start_user.astimezone(timezone.utc)
    end_utc = end_user.astimezone(timezone.utc)
    
    # 3. Filtra vendas
    daily_sales = []
    for sale in sales:
        sale_date_utc = datetime.fromisoformat(sale['saleDate'].replace('Z', '+00:00'))
        if start_utc <= sale_date_utc <= end_utc:
            daily_sales.append(sale)
    
    # 4. Converte para timezone do usuário na apresentação
    report = []
    for sale in daily_sales:
        sale_date_utc = datetime.fromisoformat(sale['saleDate'].replace('Z', '+00:00'))
        sale_date_user = sale_date_utc.astimezone(user_tz)
        
        report.append({
            'id': sale['id'],
            'amount': sale['amount'],
            'saleDate': sale_date_user.strftime('%d/%m/%Y %H:%M:%S')
        })
    
    return jsonify({'date': date_str, 'timezone': tz_str, 'sales': report, 'total': len(report)})

if __name__ == '__main__':
    app.run(port=3000)
```

**Bibliotecas necessárias:**
```bash
pip install Flask pytz
```

---

#### Java (usando `java.time` com `ZonedDateTime`)

```java
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

class Sale {
    int id;
    double amount;
    String customerId;
    ZonedDateTime saleDate;  // CORRIGIDO: ZonedDateTime tem timezone
    long createdAt;
    
    public Sale(int id, double amount, String customerId) {
        this.id = id;
        this.amount = amount;
        this.customerId = customerId;
        this.saleDate = ZonedDateTime.now(ZoneId.of("UTC"));  // Salva em UTC
        this.createdAt = System.currentTimeMillis();
    }
}

class SalesService {
    private List<Sale> sales = new ArrayList<>();
    
    public Sale createSale(double amount, String customerId) {
        Sale sale = new Sale(sales.size() + 1, amount, customerId);
        sales.add(sale);
        return sale;
    }
    
    // CORRIGIDO: Filtra considerando timezone
    public List<SaleReport> getDailyReport(String dateStr, String timezoneStr) {
        ZoneId userZone = ZoneId.of(timezoneStr);
        
        // 1. Cria range do dia no timezone do usuário
        LocalDate date = LocalDate.parse(dateStr);
        ZonedDateTime startUser = date.atStartOfDay(userZone);
        ZonedDateTime endUser = date.atTime(23, 59, 59, 999999999).atZone(userZone);
        
        // 2. Converte para UTC
        ZonedDateTime startUTC = startUser.withZoneSameInstant(ZoneId.of("UTC"));
        ZonedDateTime endUTC = endUser.withZoneSameInstant(ZoneId.of("UTC"));
        
        // 3. Filtra e converte para timezone do usuário
        return sales.stream()
            .filter(sale -> {
                return !sale.saleDate.isBefore(startUTC) && !sale.saleDate.isAfter(endUTC);
            })
            .map(sale -> {
                ZonedDateTime saleDateUser = sale.saleDate.withZoneSameInstant(userZone);
                return new SaleReport(
                    sale.id,
                    sale.amount,
                    saleDateUser.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
                );
            })
            .collect(Collectors.toList());
    }
}
```

---

### Tratamento de Casos Extremos

1. **Horário de verão (DST):**
   - Bibliotecas como `pytz`, `date-fns-tz`, `java.time` lidam automaticamente
   - Exemplo: em 16/10/2022 00:00 BRT, horário de verão começa (pula para 01:00)
   - `pytz.timezone('America/Sao_Paulo').localize(...)` resolve ambiguidades

2. **Vendas exatamente à meia-noite:**
   - Range deve usar `>=` e `<=` (não `<`)
   - `endOfDay` deve incluir `23:59:59.999`

3. **Mudança de timezone durante o período:**
   - Se relatório abrange dias com e sem DST, conversão deve ser feita por venda individual
   - Não usar offset fixo (ex: `-3 horas`), usar `ZoneId`/`pytz.timezone`

---

### Resumo das Correções

**Armazenar:** sempre em UTC (`.toISOString()`, `datetime.now(timezone.utc)`, `ZonedDateTime.now(ZoneId.of("UTC"))`)  
**Filtrar:** converter range de dia do timezone do usuário para UTC antes de comparar  
**Apresentar:** converter de UTC para timezone do usuário apenas na resposta  
**Biblioteca:** usar `date-fns-tz`, `pytz`, `java.time` (evitar lógica manual)  
**Casos extremos:** bibliotecas lidam com DST automaticamente  

**Resultado esperado:**
- Venda em SP 23:30 aparece no dia correto para todos os timezones
- Relatórios consistentes independente do servidor ou cliente
<!-- /SECTION:solution-outline -->
