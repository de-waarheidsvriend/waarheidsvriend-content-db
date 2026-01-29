import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function EditionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Edities</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            De editie-overzicht functionaliteit wordt geïmplementeerd in Epic 2.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
