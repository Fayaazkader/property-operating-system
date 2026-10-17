/** Intent extraction proposes parameters only. SQL resolves records and authority. */
export function statementIntent(text: string) {
 const match=/^(?:flow[, :]*)?(?:please\s+)?(?:send|email)\s+(.+?)\s+(?:their\s+)?(?:the\s+)?last\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+months?\s+(?:of\s+)?statements[.!]?$/i.exec(text.trim());
 if(!match)return null;
 const words=['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
 const months=Number(match[2])||words.indexOf(match[2].toLowerCase())+1;
 if(months<1||months>12||match[1].length>150)return null;
 return {query:match[1].trim(),months};
}
