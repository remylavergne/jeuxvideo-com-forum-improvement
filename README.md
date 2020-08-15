## Sources

- <http://youmightnotneedjquery.com/>
- <https://www.youtube.com/watch?v=dJgLkhUTB-A&list=PLC3y8-rFHvwg2-q6Kvw3Tl_4xhxtIaNlY>
- <https://developer.chrome.com/extensions/getstarted>
- <https://developer.chrome.com/extensions/api_index>
- <https://developer.chrome.com/extensions/manifest>
- <https://shiffman.net/a2z/chrome-ext/>
- <https://www.youtube.com/watch?v=9Tl3OmwrSaM&list=PLRqwX-V7Uu6bL9VOMT65ahNEri9uqLWfS>

- [Communication entre content_scripts et background](https://stackoverflow.com/questions/17246133/contexts-and-methods-for-communication-between-the-browser-action-background-sc)


"content_scripts" => Lancer à chaques fois qu'une page du domaine est ouverte. C'est une Sandbox. C'est le seul qui peut appliquer des changements sur l'html de l'onglet.
"background" => Permet d'accéder à l'API Chrome complète
"browser_actions" => Bouton + menu qui s'affiche
