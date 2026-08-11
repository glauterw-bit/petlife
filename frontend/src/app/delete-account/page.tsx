import Link from 'next/link'
import { ArrowLeft, PawPrint, Trash2, Mail } from 'lucide-react'

export const metadata = {
  title: 'Excluir conta e dados — PetLife',
  description: 'Como excluir sua conta e seus dados do PetLife, o app de saúde do seu pet.',
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-surface-600 dark:text-surface-300 hover:text-surface-900">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-surface-900 dark:text-white">PetLife</span>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-8 sm:p-10">
          <div className="flex items-center gap-3 mb-1">
            <Trash2 className="w-7 h-7 text-red-500" />
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Excluir conta e dados</h1>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-8">
            PetLife — Saúde do Pet (desenvolvido por Glauter Wanderson Ferreira Correia)
          </p>

          <div className="prose prose-sm max-w-none text-surface-700 dark:text-surface-200 leading-relaxed space-y-6">
            <section>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mt-2 mb-2">
                Como excluir sua conta pelo app
              </h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Abra o app <strong>PetLife</strong> e faça login</li>
                <li>
                  Toque em <strong>Mais → Configurações</strong>
                </li>
                <li>
                  Role até o fim e toque em <strong>&quot;Apagar minha conta&quot;</strong>
                </li>
                <li>
                  Confirme digitando sua senha e o texto <strong>&quot;APAGAR MINHA CONTA&quot;</strong>
                </li>
              </ol>
              <p className="mt-2">A exclusão é imediata e definitiva.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mt-6 mb-2">
                Não consegue acessar o app?
              </h2>
              <p>
                Envie um e-mail para{' '}
                <a href="mailto:glauterw@gmail.com?subject=Exclusão de conta PetLife" className="text-primary-600 font-semibold">
                  glauterw@gmail.com
                </a>{' '}
                com o assunto <strong>&quot;Exclusão de conta PetLife&quot;</strong>, a partir do e-mail cadastrado.
                Confirmaremos a exclusão em até 7 dias.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mt-6 mb-2">
                O que é excluído
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Dados de cadastro: nome, e-mail, telefone e senha</li>
                <li>Todos os pets e seus históricos (vacinas, exames, peso, rotinas)</li>
                <li>Fotos enviadas, passeios com GPS, gastos e conversas com a IA Vyron</li>
                <li>Identificadores e registros de uso associados à conta</li>
              </ul>
              <p className="mt-2">
                <strong>O que pode ser mantido:</strong> registros fiscais de assinaturas processadas pela
                App Store ou Google Play (mantidos pelas próprias lojas) e logs técnicos anonimizados,
                sem vínculo com você, por até 90 dias.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mt-6 mb-2">
                Excluir apenas alguns dados (sem excluir a conta)
              </h2>
              <p>
                Dentro do app você pode, a qualquer momento, excluir pets individuais, registros de
                vacinas, passeios, gastos e fotos — sem precisar encerrar sua conta. Também pode
                solicitar a exclusão de dados específicos pelo e-mail acima.
              </p>
            </section>

            <div className="mt-8 p-4 bg-surface-50 dark:bg-surface-700/50 rounded-2xl flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary-600 shrink-0" />
              <p className="text-sm">
                Dúvidas? Fale com a gente:{' '}
                <a href="mailto:glauterw@gmail.com" className="text-primary-600 font-semibold">
                  glauterw@gmail.com
                </a>{' '}
                · Veja também nossa{' '}
                <Link href="/privacy" className="text-primary-600 font-semibold">
                  Política de Privacidade
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
