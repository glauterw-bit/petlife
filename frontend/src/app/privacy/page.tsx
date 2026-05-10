import Link from 'next/link'
import { ArrowLeft, PawPrint } from 'lucide-react'

export const metadata = {
  title: 'Política de Privacidade — PetLife',
  description: 'Como o PetLife coleta, usa e protege seus dados. Em conformidade com a LGPD.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-900">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-surface-900">PetLife</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-surface-100 p-8 sm:p-10">
          <h1 className="text-3xl font-bold text-surface-900 mb-1">Política de Privacidade</h1>
          <p className="text-sm text-surface-500 mb-8">Última atualização: 10 de maio de 2026</p>

          <div className="prose prose-sm max-w-none text-surface-700 leading-relaxed space-y-6">
            <p>
              Esta Política explica como o PetLife coleta, usa e protege seus dados pessoais.
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018) e
              diretrizes da Apple App Store.
            </p>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">1. Dados que coletamos</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Cadastro:</strong> nome, e-mail, telefone (opcional), senha (hash bcrypt — nunca em texto claro)</li>
                <li><strong>Pet:</strong> nome, espécie, raça, datas, peso, microchip, foto, histórico de vacinas e exames</li>
                <li><strong>Localização:</strong> apenas quando você abre &quot;Buscar clínicas próximas&quot; — em primeiro plano e em tempo real</li>
                <li><strong>Uso e diagnóstico:</strong> logs anonimizados, identificador único do dispositivo (Apple IDFV)</li>
              </ul>
              <p className="mt-2 text-surface-600 text-sm">
                Não coletamos: dados bancários, conteúdo de mensagens fora do app, localização em background,
                contatos do celular (exceto se você convidar família como co-tutor).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">2. Como usamos seus dados</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Prover funcionalidades do app (pets, lembretes, IA)</li>
                <li>Personalizar análises da IA Vyron com base nas características do seu pet</li>
                <li>Enviar lembretes de vacinação via push notification</li>
                <li>Mostrar clínicas próximas via OpenStreetMap</li>
                <li>Diagnosticar problemas técnicos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">3. Inteligência Artificial</h2>
              <p>
                A Vyron IA e a identificação de raça por foto usam o modelo Claude da Anthropic.
                Quando você usa esses recursos, sua pergunta e/ou foto é enviada à Anthropic via
                API criptografada. A Anthropic <strong>não usa seus dados para treinar modelos</strong>.
                Não anexamos seu nome ou e-mail à requisição — apenas o contexto do pet.
              </p>
              <p className="text-sm">
                Mais detalhes: <a className="text-primary-600 underline" href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">anthropic.com/legal/privacy</a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">4. Compartilhamento</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Nunca vendemos seus dados.</strong></li>
                <li>Compartilhamos com Anthropic apenas o necessário para IA.</li>
                <li>Não compartilhamos com anunciantes.</li>
                <li>Quando você compartilha a carteirinha do pet (link público), apenas aquele pet fica acessível — o restante da sua conta permanece privado.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">5. Seus direitos (LGPD)</h2>
              <p>Você pode:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Solicitar uma cópia de todos os seus dados</li>
                <li>Corrigir dados incorretos</li>
                <li>Solicitar exclusão da conta e de todos os dados associados</li>
                <li>Revogar consentimento a qualquer momento</li>
              </ul>
              <p className="mt-2">
                Como exercer: envie e-mail para <a href="mailto:glauterw@gmail.com" className="text-primary-600 underline">glauterw@gmail.com</a> com
                assunto &quot;Direitos LGPD&quot;. Respondemos em até 15 dias.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">6. Segurança</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Banco Postgres com backup automático (Railway)</li>
                <li>Comunicação 100% HTTPS/TLS</li>
                <li>Senhas armazenadas como hash bcrypt</li>
                <li>Tokens JWT com expiração de 7 dias</li>
              </ul>
              <p className="mt-2">Se você apagar a conta, todos os dados são removidos em até 30 dias.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">7. Crianças</h2>
              <p>
                O PetLife não é destinado a menores de 13 anos. Se você é responsável legal e identificou que uma
                criança usa o app, entre em contato para exclusão.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 mt-6 mb-2">8. Contato</h2>
              <p>
                <strong>Responsável pelos dados:</strong> Glauter Wanderson Ferreira Correia<br />
                <strong>E-mail:</strong> <a href="mailto:glauterw@gmail.com" className="text-primary-600 underline">glauterw@gmail.com</a><br />
                <strong>País:</strong> Brasil
              </p>
            </section>

            <p className="text-sm text-surface-500 italic mt-8">
              Ao usar o PetLife você concorda com esta Política de Privacidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
